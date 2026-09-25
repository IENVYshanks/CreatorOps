import type {
  InstagramAnalyticsMedia,
  InstagramAnalyticsRange,
} from '@creatorpilot/contracts';

export interface InstagramAnalyticsProviderSnapshot {
  profile: {
    username: string;
    accountType: string;
    followersCount: number;
    mediaCount: number;
  };
  metrics: {
    views: number | null;
    reach: number | null;
    accountsEngaged: number | null;
    totalInteractions: number | null;
  };
  recentMedia: InstagramAnalyticsMedia[];
}

export interface InstagramAnalyticsProvider {
  getDashboard(
    accountId: string,
    accessToken: string,
    rangeDays: InstagramAnalyticsRange,
  ): Promise<InstagramAnalyticsProviderSnapshot>;
}

export class InstagramAnalyticsProviderError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InstagramAnalyticsProviderError';
  }
}
