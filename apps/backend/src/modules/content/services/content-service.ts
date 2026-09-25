import type {
  ContentDraft,
  CreateContentDraftRequest,
  UpdateContentDraftRequest,
  WorkspaceDetails,
} from '@creatorpilot/contracts';

import { ApplicationError } from '../../../shared/application-error.js';
import type { ContentRepository } from '../repositories/content-repository.js';

export interface ContentWorkspaceAccess {
  getForUser(userId: string, workspaceId: string): Promise<WorkspaceDetails>;
}

export class ContentService {
  public constructor(
    private readonly repository: ContentRepository,
    private readonly workspaceAccess: ContentWorkspaceAccess,
  ) {}

  public async create(
    userId: string,
    workspaceId: string,
    input: CreateContentDraftRequest,
  ): Promise<ContentDraft> {
    await this.workspaceAccess.getForUser(userId, workspaceId);
    return this.repository.create({
      ...input,
      workspaceId,
      createdByUserId: userId,
    });
  }

  public async list(
    userId: string,
    workspaceId: string,
  ): Promise<ContentDraft[]> {
    await this.workspaceAccess.getForUser(userId, workspaceId);
    return this.repository.listForWorkspace(workspaceId);
  }

  public async get(
    userId: string,
    workspaceId: string,
    contentId: string,
  ): Promise<ContentDraft> {
    await this.workspaceAccess.getForUser(userId, workspaceId);
    const content = await this.repository.findForWorkspace(
      workspaceId,
      contentId,
    );
    if (!content) throw contentNotFound();
    return content;
  }

  public async update(
    userId: string,
    workspaceId: string,
    contentId: string,
    input: UpdateContentDraftRequest,
  ): Promise<ContentDraft> {
    await this.workspaceAccess.getForUser(userId, workspaceId);
    const content = await this.repository.update(workspaceId, contentId, input);
    if (!content) throw contentNotFound();
    return content;
  }

  public async delete(
    userId: string,
    workspaceId: string,
    contentId: string,
  ): Promise<void> {
    await this.workspaceAccess.getForUser(userId, workspaceId);
    if (!(await this.repository.delete(workspaceId, contentId))) {
      throw contentNotFound();
    }
  }
}

function contentNotFound(): ApplicationError {
  return new ApplicationError(404, 'CONTENT_NOT_FOUND', 'Content not found');
}
