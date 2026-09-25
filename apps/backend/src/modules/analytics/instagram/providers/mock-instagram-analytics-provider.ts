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
    const multiplier = rangeDays / 7;

    return Promise.resolve({
      profile: {
        username: 'creatorpilot_demo',
        accountType: 'BUSINESS',
        followersCount: 12_480,
        mediaCount: 86,
      },
      metrics: {
        views: Math.round(18_420 * multiplier),
        reach: Math.round(11_760 * multiplier),
        accountsEngaged: Math.round(1_284 * multiplier),
        totalInteractions: Math.round(2_106 * multiplier),
      },
      recentMedia: [],
    });
  }
}
