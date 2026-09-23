import type {
  WorkspaceDetails,
  WorkspaceMember,
  WorkspaceSummary,
} from '@creatorpilot/contracts';

// Database operations required by the workspace service.
export interface WorkspaceRepository {
  createOwnedWorkspace(userId: string, name: string): Promise<WorkspaceSummary>;
  listForUser(userId: string): Promise<WorkspaceSummary[]>;
  findForUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceDetails | undefined>;
  listMembersForUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMember[] | undefined>;
  addMember(
    workspaceId: string,
    userId: string,
    email: string,
  ): Promise<WorkspaceMember | undefined>;
  removeMember(workspaceId: string, userId: string): Promise<boolean>;
}
