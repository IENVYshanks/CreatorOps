import type { InstagramAnalyticsMedia } from '@creatorpilot/contracts';
import { describe, expect, it } from 'vitest';

import { analyzeInstagramOutreach } from '../../../src/modules/analytics/instagram/services/instagram-outreach-analyzer.js';

describe('Instagram outreach analyzer', () => {
  it('identifies a material format advantage with supporting evidence', () => {
    const media = [
      createMedia(1, 'CAROUSEL_ALBUM', 220, 9),
      createMedia(2, 'CAROUSEL_ALBUM', 200, 9),
      createMedia(3, 'CAROUSEL_ALBUM', 210, 9),
      createMedia(4, 'CAROUSEL_ALBUM', 190, 9),
      createMedia(5, 'VIDEO', 100, 19),
      createMedia(6, 'VIDEO', 110, 19),
      createMedia(7, 'VIDEO', 90, 19),
      createMedia(8, 'VIDEO', 100, 19),
    ];

    const analysis = analyzeInstagramOutreach(media);

    expect(analysis.status).toBe('ready');
    expect(analysis.sampleSize).toBe(8);
    expect(analysis.patterns).toContainEqual(
      expect.objectContaining({
        type: 'format',
        title: 'Carousels perform best',
      }),
    );
    expect(analysis.recommendations).toContainEqual(
      expect.objectContaining({
        title: 'Prioritize carousels',
        confidence: 'high',
      }),
    );
  });

  it('does not manufacture recommendations from a small sample', () => {
    const analysis = analyzeInstagramOutreach([
      createMedia(1, 'IMAGE', 80, 9),
      createMedia(2, 'VIDEO', 120, 19),
      createMedia(3, 'CAROUSEL_ALBUM', 160, 14),
    ]);

    expect(analysis).toMatchObject({
      status: 'insufficient_data',
      sampleSize: 3,
      patterns: [],
      recommendations: [],
    });
  });

  it('reports no decisive pattern when differences are below the threshold', () => {
    const analysis = analyzeInstagramOutreach([
      createMedia(1, 'IMAGE', 100, 9),
      createMedia(2, 'IMAGE', 102, 9),
      createMedia(3, 'VIDEO', 98, 19),
      createMedia(4, 'VIDEO', 101, 19),
    ]);

    expect(analysis.status).toBe('ready');
    expect(analysis.patterns).toEqual([]);
    expect(analysis.recommendations).toEqual([]);
    expect(analysis.summary).toContain('No performance difference');
  });
});

function createMedia(
  id: number,
  mediaType: InstagramAnalyticsMedia['mediaType'],
  totalInteractions: number,
  hour: number,
): InstagramAnalyticsMedia {
  return {
    id: String(id),
    caption: null,
    mediaType,
    mediaProductType: null,
    mediaUrl: null,
    thumbnailUrl: null,
    permalink: `https://www.instagram.com/p/${String(id)}/`,
    timestamp: new Date(Date.UTC(2026, 8, id, hour)).toISOString(),
    likeCount: totalInteractions,
    commentsCount: 0,
    views: totalInteractions * 8,
    reach: totalInteractions * 5,
    saved: null,
    shares: null,
    totalInteractions,
  };
}
