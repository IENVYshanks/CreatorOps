import type { CommentSentimentSummary } from '@creatorpilot/contracts';

export interface SaveInstagramPostSentimentInput
  extends CommentSentimentSummary {
  workspaceId: string;
  instagramPostId: string;
  postPublishedAt: Date;
  analyzedAt: Date;
}

export interface InstagramPostSentimentRepository {
  save(input: SaveInstagramPostSentimentInput): Promise<void>;
}
