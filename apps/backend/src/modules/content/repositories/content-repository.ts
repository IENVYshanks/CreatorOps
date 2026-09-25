import type {
  ContentDraft,
  CreateContentDraftRequest,
  UpdateContentDraftRequest,
} from '@creatorpilot/contracts';

export interface CreateContentDraftInput extends CreateContentDraftRequest {
  workspaceId: string;
  createdByUserId: string;
}

export interface ContentRepository {
  create(input: CreateContentDraftInput): Promise<ContentDraft>;
  listForWorkspace(workspaceId: string): Promise<ContentDraft[]>;
  findForWorkspace(
    workspaceId: string,
    contentId: string,
  ): Promise<ContentDraft | undefined>;
  update(
    workspaceId: string,
    contentId: string,
    input: UpdateContentDraftRequest,
  ): Promise<ContentDraft | undefined>;
  delete(workspaceId: string, contentId: string): Promise<boolean>;
}
