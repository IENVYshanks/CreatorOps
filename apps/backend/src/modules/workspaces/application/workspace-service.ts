import type {
  CreateWorkspaceRequest,
  WorkspaceSummary,
} from '@creatorpilot/contracts';

import type { WorkspaceRepository } from './ports.js';

export class WorkspaceService {
  public constructor(private readonly repository: WorkspaceRepository) {}

  public create(
    userId: string,
    input: CreateWorkspaceRequest,
  ): Promise<WorkspaceSummary> {
    return this.repository.createOwnedWorkspace(userId, input.name);
  }

  public list(userId: string): Promise<WorkspaceSummary[]> {
    return this.repository.listForUser(userId);
  }
}
