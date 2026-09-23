import type {
  WorkspaceDetails,
  WorkspaceMember,
  WorkspaceSummary,
} from '@creatorpilot/contracts';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { AppDatabase } from '../../database/client.js';
import { users } from '../identity/database/identity-database-schema.js';
import type { WorkspaceRepository } from './workspace-repository.js';
import {
  workspaceMemberships,
  workspaces,
} from './workspace-database-schema.js';

const requesterMembership = alias(
  workspaceMemberships,
  'requester_workspace_membership',
);
const listedMembership = alias(
  workspaceMemberships,
  'listed_workspace_membership',
);

export class PostgresWorkspaceRepository implements WorkspaceRepository {
  public constructor(private readonly database: AppDatabase) {}

  public createOwnedWorkspace(
    userId: string,
    name: string,
  ): Promise<WorkspaceSummary> {
    return this.database.transaction(async (transaction) => {
      const [workspace] = await transaction
        .insert(workspaces)
        .values({ name, createdByUserId: userId })
        .returning({ id: workspaces.id, name: workspaces.name });

      if (!workspace) {
        throw new Error('Workspace insert returned no record');
      }

      await transaction.insert(workspaceMemberships).values({
        workspaceId: workspace.id,
        userId,
        role: 'owner',
      });

      return { ...workspace, role: 'owner' as const };
    });
  }

  public async listForUser(userId: string): Promise<WorkspaceSummary[]> {
    return this.database
      .select({
        id: workspaces.id,
        name: workspaces.name,
        role: workspaceMemberships.role,
      })
      .from(workspaceMemberships)
      .innerJoin(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      )
      .where(eq(workspaceMemberships.userId, userId));
  }

  public async findForUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceDetails | undefined> {
    const [workspace] = await this.database
      .select({
        id: workspaces.id,
        name: workspaces.name,
        role: workspaceMemberships.role,
        createdAt: workspaces.createdAt,
      })
      .from(workspaceMemberships)
      .innerJoin(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      )
      .where(
        and(
          eq(workspaceMemberships.userId, userId),
          eq(workspaces.id, workspaceId),
        ),
      )
      .limit(1);

    if (!workspace) {
      return undefined;
    }

    return {
      ...workspace,
      createdAt: workspace.createdAt.toISOString(),
    };
  }

  public async listMembersForUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMember[] | undefined> {
    const members = await this.database
      .select({
        userId: listedMembership.userId,
        email: users.email,
        role: listedMembership.role,
        joinedAt: listedMembership.createdAt,
      })
      .from(requesterMembership)
      .innerJoin(
        listedMembership,
        eq(listedMembership.workspaceId, requesterMembership.workspaceId),
      )
      .innerJoin(users, eq(users.id, listedMembership.userId))
      .where(
        and(
          eq(requesterMembership.userId, userId),
          eq(requesterMembership.workspaceId, workspaceId),
        ),
      );

    if (members.length === 0) {
      return undefined;
    }

    return members.map((member) => ({
      ...member,
      joinedAt: member.joinedAt.toISOString(),
    }));
  }

  public async addMember(
    workspaceId: string,
    userId: string,
    email: string,
  ): Promise<WorkspaceMember | undefined> {
    try {
      const [membership] = await this.database
        .insert(workspaceMemberships)
        .values({ workspaceId, userId, role: 'member' })
        .returning({
          role: workspaceMemberships.role,
          joinedAt: workspaceMemberships.createdAt,
        });

      if (!membership) {
        throw new Error('Workspace membership insert returned no record');
      }

      return {
        userId,
        email,
        role: membership.role,
        joinedAt: membership.joinedAt.toISOString(),
      };
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return undefined;
      }

      throw error;
    }
  }

  public async removeMember(
    workspaceId: string,
    userId: string,
  ): Promise<boolean> {
    const removedMemberships = await this.database
      .delete(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, userId),
          eq(workspaceMemberships.role, 'member'),
        ),
      )
      .returning({ userId: workspaceMemberships.userId });

    return removedMemberships.length > 0;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
