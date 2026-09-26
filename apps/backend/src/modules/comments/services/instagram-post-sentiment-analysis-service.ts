import type { CommentSentimentSummary } from '@creatorpilot/contracts';

import type { InstagramCommentProvider } from '../providers/instagram-comment-provider.js';
import type { InstagramPostSentimentRepository } from '../repositories/instagram-post-sentiment-repository.js';
import { summarizeCommentSentiments } from './comment-sentiment-summarizer.js';

export interface AnalyzeInstagramPostSentimentInput {
  workspaceId: string;
  instagramPostId: string;
  postPublishedAt: Date;
  accessToken: string;
}

export class InstagramPostSentimentAnalysisService {
  public constructor(
    private readonly commentProvider: InstagramCommentProvider,
    private readonly repository: InstagramPostSentimentRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async analyze(
    input: AnalyzeInstagramPostSentimentInput,
  ): Promise<CommentSentimentSummary> {
    const summary: CommentSentimentSummary = {
      positiveCount: 0,
      neutralCount: 0,
      negativeCount: 0,
      totalComments: 0,
    };
    let cursor: string | undefined;

    do {
      const page = await this.commentProvider.fetchPage({
        accessToken: input.accessToken,
        instagramPostId: input.instagramPostId,
        ...(cursor === undefined ? {} : { cursor }),
      });
      const pageSummary = summarizeCommentSentiments(
        page.comments.map((comment) => comment.text),
      );

      summary.positiveCount += pageSummary.positiveCount;
      summary.neutralCount += pageSummary.neutralCount;
      summary.negativeCount += pageSummary.negativeCount;
      summary.totalComments += pageSummary.totalComments;
      cursor = page.nextCursor;
    } while (cursor !== undefined);

    await this.repository.save({
      workspaceId: input.workspaceId,
      instagramPostId: input.instagramPostId,
      postPublishedAt: input.postPublishedAt,
      ...summary,
      analyzedAt: this.now(),
    });

    return summary;
  }
}
