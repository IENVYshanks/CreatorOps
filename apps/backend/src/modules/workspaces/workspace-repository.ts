import type { WorkspaceSummary } from '@creatorpilot/contracts';

// Database operations required by the workspace service.
export interface WorkspaceRepository {
  createOwnedWorkspace(userId: string, name: string): Promise<WorkspaceSummary>;
  listForUser(userId: string): Promise<WorkspaceSummary[]>;
}
