import type {
  AddWorkspaceMemberRequest,
  CreateWorkspaceRequest,
  WorkspaceDetails,
  WorkspaceMember,
  WorkspaceSummary,
} from '@creatorpilot/contracts';

import { ApplicationError } from '../../shared/application-error.js';
import type { UserDirectory } from '../identity/users/user-directory.js';
import type { WorkspaceRepository } from './workspace-repository.js';

export class WorkspaceService {
  public constructor(
    private readonly repository: WorkspaceRepository,
    private readonly userDirectory: UserDirectory,
  ) {}

  public create(
    userId: string,
    input: CreateWorkspaceRequest,
  ): Promise<WorkspaceSummary> {
    return this.repository.createOwnedWorkspace(userId, input.name);
  }

  public list(userId: string): Promise<WorkspaceSummary[]> {
    return this.repository.listForUser(userId);
  }

  public async getForUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceDetails> {
    const workspace = await this.repository.findForUser(userId, workspaceId);

    if (!workspace) {
      throw new ApplicationError(
        404,
        'WORKSPACE_NOT_FOUND',
        'Workspace not found',
      );
    }

    return workspace;
  }

  public async listMembers(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMember[]> {
    const members = await this.repository.listMembersForUser(
      userId,
      workspaceId,
    );

    if (!members) {
      throw new ApplicationError(
        404,
        'WORKSPACE_NOT_FOUND',
        'Workspace not found',
      );
    }

    return members;
  }

  public async addMember(
    requesterUserId: string,
    workspaceId: string,
    input: AddWorkspaceMemberRequest,
  ): Promise<WorkspaceMember> {
    const workspace = await this.repository.findForUser(
      requesterUserId,
      workspaceId,
    );

    if (!workspace) {
      throw new ApplicationError(
        404,
        'WORKSPACE_NOT_FOUND',
        'Workspace not found',
      );
    }

    if (workspace.role !== 'owner') {
      throw new ApplicationError(
        403,
        'WORKSPACE_OWNER_REQUIRED',
        'Only a workspace owner can add members',
      );
    }

    const user = await this.userDirectory.findUserByEmail(input.email);

    if (!user) {
      throw new ApplicationError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const member = await this.repository.addMember(
      workspaceId,
      user.id,
      user.email,
    );

    if (!member) {
      throw new ApplicationError(
        409,
        'WORKSPACE_MEMBER_EXISTS',
        'User is already a workspace member',
      );
    }

    return member;
  }

  public async removeMember(
    requesterUserId: string,
    workspaceId: string,
    targetUserId: string,
  ): Promise<void> {
    const workspace = await this.repository.findForUser(
      requesterUserId,
      workspaceId,
    );

    if (!workspace) {
      throw new ApplicationError(
        404,
        'WORKSPACE_NOT_FOUND',
        'Workspace not found',
      );
    }

    if (workspace.role !== 'owner') {
      throw new ApplicationError(
        403,
        'WORKSPACE_OWNER_REQUIRED',
        'Only a workspace owner can remove members',
      );
    }

    if (requesterUserId === targetUserId) {
      throw new ApplicationError(
        409,
        'WORKSPACE_OWNER_CANNOT_BE_REMOVED',
        'The workspace owner cannot be removed',
      );
    }

    const removed = await this.repository.removeMember(
      workspaceId,
      targetUserId,
    );

    if (!removed) {
      throw new ApplicationError(
        404,
        'WORKSPACE_MEMBER_NOT_FOUND',
        'Workspace member not found',
      );
    }
  }
}
