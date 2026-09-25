import { z } from 'zod';

import type { InstagramAnalyticsRange } from '@creatorpilot/contracts';

import {
  InstagramAnalyticsProviderError,
  type InstagramAnalyticsProvider,
  type InstagramAnalyticsProviderSnapshot,
} from './instagram-analytics-provider.js';

const profileSchema = z.object({
  username: z.string().min(1),
  account_type: z.string().min(1),
  followers_count: z.coerce.number().int().nonnegative(),
  media_count: z.coerce.number().int().nonnegative(),
});

const mediaSchema = z.object({
  data: z.array(
    z.object({
      id: z.coerce.string().min(1),
      caption: z.string().optional(),
      media_type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM']),
      media_product_type: z.string().optional(),
      media_url: z.url().optional(),
      thumbnail_url: z.url().optional(),
      permalink: z.url(),
      timestamp: z
        .string()
        .refine(
          (value) => !Number.isNaN(Date.parse(value)),
          'Invalid Instagram timestamp',
        ),
      like_count: z.coerce.number().int().nonnegative().optional(),
      comments_count: z.coerce.number().int().nonnegative().optional(),
    }),
  ),
});

const insightsSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      total_value: z.object({ value: z.coerce.number().int().nonnegative() }),
    }),
  ),
});

export interface MetaInstagramAnalyticsProviderOptions {
  apiVersion: string;
  requestTimeoutMilliseconds?: number;
  fetch?: typeof fetch;
  now?: () => Date;
}

export class MetaInstagramAnalyticsProvider implements InstagramAnalyticsProvider {
  private readonly request: typeof fetch;
  private readonly requestTimeoutMilliseconds: number;
  private readonly now: () => Date;

  public constructor(
    private readonly options: MetaInstagramAnalyticsProviderOptions,
  ) {
    this.request = options.fetch ?? fetch;
    this.requestTimeoutMilliseconds =
      options.requestTimeoutMilliseconds ?? 10_000;
    this.now = options.now ?? (() => new Date());
  }

  public async getDashboard(
    accountId: string,
    accessToken: string,
    rangeDays: InstagramAnalyticsRange,
  ): Promise<InstagramAnalyticsProviderSnapshot> {
    const baseUrl = `https://graph.instagram.com/${this.options.apiVersion}/${encodeURIComponent(accountId)}`;
    const profileUrl = new URL(baseUrl);
    profileUrl.searchParams.set(
      'fields',
      'id,username,account_type,followers_count,media_count',
    );

    const mediaUrl = new URL(`${baseUrl}/media`);
    mediaUrl.searchParams.set(
      'fields',
      'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    );
    mediaUrl.searchParams.set('limit', '6');

    const until = Math.floor(this.now().getTime() / 1000);
    const since = until - rangeDays * 24 * 60 * 60;
    const insightsUrl = new URL(`${baseUrl}/insights`);
    insightsUrl.searchParams.set(
      'metric',
      'views,reach,accounts_engaged,total_interactions',
    );
    insightsUrl.searchParams.set('period', 'day');
    insightsUrl.searchParams.set('metric_type', 'total_value');
    insightsUrl.searchParams.set('since', String(since));
    insightsUrl.searchParams.set('until', String(until));

    const headers = { Authorization: `Bearer ${accessToken}` };
    const [profile, media, insights] = await Promise.all([
      this.requestJson(profileUrl, profileSchema, headers),
      this.requestJson(mediaUrl, mediaSchema, headers),
      this.requestJson(insightsUrl, insightsSchema, headers),
    ]);
    const metricValues = new Map(
      insights.data.map((metric) => [metric.name, metric.total_value.value]),
    );

    return {
      profile: {
        username: profile.username,
        accountType: profile.account_type,
        followersCount: profile.followers_count,
        mediaCount: profile.media_count,
      },
      metrics: {
        views: metricValues.get('views') ?? null,
        reach: metricValues.get('reach') ?? null,
        accountsEngaged: metricValues.get('accounts_engaged') ?? null,
        totalInteractions: metricValues.get('total_interactions') ?? null,
      },
      recentMedia: media.data.map((item) => ({
        id: item.id,
        caption: item.caption ?? null,
        mediaType: item.media_type,
        mediaProductType: item.media_product_type ?? null,
        mediaUrl: item.media_url ?? null,
        thumbnailUrl: item.thumbnail_url ?? null,
        permalink: item.permalink,
        timestamp: new Date(item.timestamp).toISOString(),
        likeCount: item.like_count ?? 0,
        commentsCount: item.comments_count ?? 0,
      })),
    };
  }

  private async requestJson<T>(
    url: URL,
    schema: z.ZodType<T>,
    headers: Record<string, string>,
  ): Promise<T> {
    try {
      const response = await this.request(url, {
        headers,
        signal: AbortSignal.timeout(this.requestTimeoutMilliseconds),
      });

      if (!response.ok) {
        throw new InstagramAnalyticsProviderError(
          `Instagram returned HTTP ${String(response.status)}`,
        );
      }

      return schema.parse(await response.json());
    } catch (error: unknown) {
      if (error instanceof InstagramAnalyticsProviderError) {
        throw error;
      }

      throw new InstagramAnalyticsProviderError('Instagram request failed');
    }
  }
}
