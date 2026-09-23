import type { WorkspaceSummary } from '@creatorpilot/contracts';
import { eq } from 'drizzle-orm';

import type { AppDatabase } from '../../database/client.js';
import type { WorkspaceRepository } from './workspace-repository.js';
import {
  workspaceMemberships,
  workspaces,
} from './workspace-database-schema.js';

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
}
