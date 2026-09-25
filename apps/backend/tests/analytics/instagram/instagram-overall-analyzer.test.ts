import type { InstagramAnalyticsMedia } from '@creatorpilot/contracts';
import { describe, expect, it } from 'vitest';

import { analyzeOverallInstagramMedia } from '../../../src/modules/analytics/instagram/services/instagram-overall-analyzer.js';

describe('Instagram overall analytics', () => {
  it('summarizes all available media and exposes coverage', () => {
    const overview = analyzeOverallInstagramMedia(
      [
        createMedia('one', 'IMAGE', 80, 5, '2024-01-01T10:00:00.000Z'),
        createMedia(
          'two',
          'CAROUSEL_ALBUM',
          180,
          20,
          '2025-01-01T10:00:00.000Z',
        ),
        createMedia(
          'three',
          'CAROUSEL_ALBUM',
          160,
          10,
          '2026-01-01T10:00:00.000Z',
        ),
      ],
      3,
    );

    expect(overview).toMatchObject({
      analyzedMediaCount: 3,
      totalMediaCount: 3,
      coverageComplete: true,
      oldestMediaAt: '2024-01-01T10:00:00.000Z',
      newestMediaAt: '2026-01-01T10:00:00.000Z',
      totalLikes: 420,
      totalComments: 35,
      totalVisibleInteractions: 455,
      averageVisibleInteractionsPerPost: 151.67,
      strongestFormat: {
        mediaType: 'CAROUSEL_ALBUM',
        postCount: 2,
        averageVisibleInteractions: 185,
      },
    });
    expect(overview.topMedia.map((item) => item.id)).toEqual([
      'two',
      'three',
      'one',
    ]);
  });

  it('reports incomplete and empty coverage accurately', () => {
    expect(analyzeOverallInstagramMedia([], 12)).toMatchObject({
      analyzedMediaCount: 0,
      totalMediaCount: 12,
      coverageComplete: false,
      oldestMediaAt: null,
      newestMediaAt: null,
      strongestFormat: null,
      topMedia: [],
    });
  });
});

function createMedia(
  id: string,
  mediaType: InstagramAnalyticsMedia['mediaType'],
  likes: number,
  comments: number,
  timestamp: string,
): InstagramAnalyticsMedia {
  return {
    id,
    caption: null,
    mediaType,
    mediaProductType: null,
    mediaUrl: null,
    thumbnailUrl: null,
    permalink: `https://www.instagram.com/p/${id}/`,
    timestamp,
    likeCount: likes,
    commentsCount: comments,
    views: null,
    reach: null,
    saved: null,
    shares: null,
    totalInteractions: null,
  };
}
