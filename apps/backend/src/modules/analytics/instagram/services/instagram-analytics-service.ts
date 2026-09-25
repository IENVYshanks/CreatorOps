import type {
  InstagramAnalyticsRange,
  InstagramAnalyticsResponse,
} from '@creatorpilot/contracts';

import type { AuthorizedInstagramAccount } from '../../../connections/instagram/services/instagram-connection-service.js';
import { ApplicationError } from '../../../../shared/application-error.js';
import {
  InstagramAnalyticsProviderError,
  type InstagramAnalyticsProvider,
} from '../providers/instagram-analytics-provider.js';
import { analyzeInstagramOutreach } from './instagram-outreach-analyzer.js';
import { analyzeOverallInstagramMedia } from './instagram-overall-analyzer.js';

export interface InstagramAuthorizedAccountAccess {
  getAuthorizedAccount(
    userId: string,
    workspaceId: string,
  ): Promise<AuthorizedInstagramAccount>;
}

export class InstagramAnalyticsService {
  public constructor(
    private readonly accounts: InstagramAuthorizedAccountAccess,
    private readonly provider: InstagramAnalyticsProvider,
  ) {}

  public async getForWorkspace(
    userId: string,
    workspaceId: string,
    rangeDays: InstagramAnalyticsRange,
  ): Promise<InstagramAnalyticsResponse> {
    const account = await this.accounts.getAuthorizedAccount(
      userId,
      workspaceId,
    );

    try {
      const dashboard = await this.provider.getDashboard(
        account.accountId,
        account.accessToken,
        rangeDays,
      );

      return {
        rangeDays,
        profile: {
          ...dashboard.profile,
          tokenExpiresAt: account.accessTokenExpiresAt?.toISOString() ?? null,
        },
        metrics: dashboard.metrics,
        recentMedia: dashboard.recentMedia,
        overall:
          rangeDays === 'overall'
            ? analyzeOverallInstagramMedia(
                dashboard.analysisMedia,
                dashboard.profile.mediaCount,
              )
            : null,
        analysis: analyzeInstagramOutreach(dashboard.analysisMedia),
      };
    } catch (error: unknown) {
      if (error instanceof InstagramAnalyticsProviderError) {
        throw new ApplicationError(
          502,
          'INSTAGRAM_ANALYTICS_UNAVAILABLE',
          'Instagram analytics are temporarily unavailable',
        );
      }

      throw error;
    }
  }
}
