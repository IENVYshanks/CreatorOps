import { describe, expect, it, vi } from 'vitest';

import type { InstagramCommentProvider } from '../../src/modules/comments/providers/instagram-comment-provider.js';
import type { InstagramPostSentimentRepository } from '../../src/modules/comments/repositories/instagram-post-sentiment-repository.js';
import { InstagramPostSentimentAnalysisService } from '../../src/modules/comments/services/instagram-post-sentiment-analysis-service.js';

const input = {
  workspaceId: 'workspace-1',
  instagramPostId: 'post-1',
  postPublishedAt: new Date('2026-09-25T10:00:00.000Z'),
  accessToken: 'secret-token',
};

describe('Instagram post sentiment analysis service', () => {
  it('analyzes every page and saves one completed summary', async () => {
    const fetchPage = vi
      .fn<InstagramCommentProvider['fetchPage']>()
      .mockResolvedValueOnce({
        comments: [
          { id: 'comment-1', text: 'Amazing post!' },
          { id: 'comment-2', text: 'When was this posted?' },
        ],
        nextCursor: 'page-2',
      })
      .mockResolvedValueOnce({
        comments: [{ id: 'comment-3', text: 'This is terrible.' }],
      });
    const save = vi.fn<InstagramPostSentimentRepository['save']>();
    const service = new InstagramPostSentimentAnalysisService(
      { fetchPage },
      { save },
      () => new Date('2026-09-26T12:00:00.000Z'),
    );

    await expect(service.analyze(input)).resolves.toEqual({
      positiveCount: 1,
      neutralCount: 1,
      negativeCount: 1,
      totalComments: 3,
    });
    expect(fetchPage).toHaveBeenNthCalledWith(1, {
      accessToken: 'secret-token',
      instagramPostId: 'post-1',
    });
    expect(fetchPage).toHaveBeenNthCalledWith(2, {
      accessToken: 'secret-token',
      instagramPostId: 'post-1',
      cursor: 'page-2',
    });
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      instagramPostId: 'post-1',
      postPublishedAt: new Date('2026-09-25T10:00:00.000Z'),
      positiveCount: 1,
      neutralCount: 1,
      negativeCount: 1,
      totalComments: 3,
      analyzedAt: new Date('2026-09-26T12:00:00.000Z'),
    });
  });

  it('does not replace the stored summary when a later page fails', async () => {
    const fetchPage = vi
      .fn<InstagramCommentProvider['fetchPage']>()
      .mockResolvedValueOnce({
        comments: [{ id: 'comment-1', text: 'Amazing post!' }],
        nextCursor: 'page-2',
      })
      .mockRejectedValueOnce(new Error('Instagram request failed'));
    const save = vi.fn<InstagramPostSentimentRepository['save']>();
    const service = new InstagramPostSentimentAnalysisService(
      { fetchPage },
      { save },
    );

    await expect(service.analyze(input)).rejects.toThrow(
      'Instagram request failed',
    );
    expect(save).not.toHaveBeenCalled();
  });
});
