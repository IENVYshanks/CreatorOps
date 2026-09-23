import type { WorkspaceSummary } from '@creatorpilot/contracts';

export interface WorkspaceRepository {
  createOwnedWorkspace(userId: string, name: string): Promise<WorkspaceSummary>;
  listForUser(userId: string): Promise<WorkspaceSummary[]>;
}
