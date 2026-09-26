import type { AppDatabase } from '../../../database/client.js';
import { instagramPostSentiments } from '../database/instagram-post-sentiment-schema.js';
import type {
  InstagramPostSentimentRepository,
  SaveInstagramPostSentimentInput,
} from './instagram-post-sentiment-repository.js';

export class PostgresInstagramPostSentimentRepository implements InstagramPostSentimentRepository {
  public constructor(private readonly database: AppDatabase) {}

  public async save(input: SaveInstagramPostSentimentInput): Promise<void> {
    const updatedAt = new Date();
    const values = {
      workspaceId: input.workspaceId,
      instagramPostId: input.instagramPostId,
      postPublishedAt: input.postPublishedAt,
      positiveCount: input.positiveCount,
      neutralCount: input.neutralCount,
      negativeCount: input.negativeCount,
      totalComments: input.totalComments,
      analyzedAt: input.analyzedAt,
      updatedAt,
    };

    await this.database
      .insert(instagramPostSentiments)
      .values(values)
      .onConflictDoUpdate({
        target: [
          instagramPostSentiments.workspaceId,
          instagramPostSentiments.instagramPostId,
        ],
        set: {
          postPublishedAt: values.postPublishedAt,
          positiveCount: values.positiveCount,
          neutralCount: values.neutralCount,
          negativeCount: values.negativeCount,
          totalComments: values.totalComments,
          analyzedAt: values.analyzedAt,
          updatedAt: values.updatedAt,
        },
      });
  }
}
