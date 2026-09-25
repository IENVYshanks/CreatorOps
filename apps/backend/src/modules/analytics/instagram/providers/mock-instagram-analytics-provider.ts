import type { InstagramAnalyticsRange } from '@creatorpilot/contracts';

import type {
  InstagramAnalyticsProvider,
  InstagramAnalyticsProviderSnapshot,
} from './instagram-analytics-provider.js';

export class MockInstagramAnalyticsProvider implements InstagramAnalyticsProvider {
  public async getDashboard(
    _accountId: string,
    _accessToken: string,
    rangeDays: InstagramAnalyticsRange,
  ): Promise<InstagramAnalyticsProviderSnapshot> {
    const multiplier = rangeDays === 'overall' ? 1 : rangeDays / 7;
    const analysisMedia = createMockMedia();

    return Promise.resolve({
      profile: {
        username: 'creatorpilot_demo',
        accountType: 'BUSINESS',
        followersCount: 12_480,
        mediaCount: 86,
      },
      metrics:
        rangeDays === 'overall'
          ? {
              views: null,
              reach: null,
              accountsEngaged: null,
              totalInteractions: null,
            }
          : {
              views: Math.round(18_420 * multiplier),
              reach: Math.round(11_760 * multiplier),
              accountsEngaged: Math.round(1_284 * multiplier),
              totalInteractions: Math.round(2_106 * multiplier),
            },
      recentMedia: analysisMedia.slice(0, 6),
      analysisMedia,
    });
  }
}

function createMockMedia(): InstagramAnalyticsProviderSnapshot['analysisMedia'] {
  return Array.from({ length: 8 }, (_, index) => {
    const isCarousel = index < 4;
    const interactions = isCarousel ? 320 - index * 12 : 150 - index * 5;
    return {
      id: `mock-media-${String(index + 1)}`,
      caption: isCarousel ? 'Practical creator tips' : 'Behind the scenes',
      mediaType: isCarousel ? 'CAROUSEL_ALBUM' : 'VIDEO',
      mediaProductType: isCarousel ? 'FEED' : 'REELS',
      mediaUrl: null,
      thumbnailUrl: null,
      permalink: `https://www.instagram.com/p/mock-${String(index + 1)}/`,
      timestamp: new Date(
        Date.UTC(2026, 8, 24 - index, isCarousel ? 9 : 19),
      ).toISOString(),
      likeCount: interactions - 10,
      commentsCount: 10,
      views: interactions * 8,
      reach: interactions * 5,
      saved: Math.round(interactions * 0.15),
      shares: Math.round(interactions * 0.1),
      totalInteractions: interactions,
    };
  });
}
