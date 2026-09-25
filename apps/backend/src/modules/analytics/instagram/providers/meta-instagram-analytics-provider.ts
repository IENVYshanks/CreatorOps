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
  paging: z
    .object({
      next: z.url().optional(),
    })
    .optional(),
});

const insightsSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      total_value: z.object({ value: z.coerce.number().int().nonnegative() }),
    }),
  ),
});

const mediaInsightsSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      total_value: z
        .object({ value: z.coerce.number().int().nonnegative() })
        .optional(),
      values: z
        .array(z.object({ value: z.coerce.number().int().nonnegative() }))
        .optional(),
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
    const isOverall = rangeDays === 'overall';
    mediaUrl.searchParams.set('limit', isOverall ? '100' : '20');

    const until = Math.floor(this.now().getTime() / 1000);
    const since = isOverall ? undefined : until - rangeDays * 24 * 60 * 60;
    const insightsUrl = new URL(`${baseUrl}/insights`);
    insightsUrl.searchParams.set(
      'metric',
      'views,reach,accounts_engaged,total_interactions',
    );
    insightsUrl.searchParams.set('period', 'day');
    insightsUrl.searchParams.set('metric_type', 'total_value');
    if (since !== undefined)
      insightsUrl.searchParams.set('since', String(since));
    insightsUrl.searchParams.set('until', String(until));

    const headers = { Authorization: `Bearer ${accessToken}` };
    const [profile, firstMediaPage, insights] = await Promise.all([
      this.requestJson(profileUrl, profileSchema, headers),
      this.requestJson(mediaUrl, mediaSchema, headers),
      isOverall
        ? Promise.resolve({ data: [] } as z.infer<typeof insightsSchema>)
        : this.requestJson(insightsUrl, insightsSchema, headers),
    ]);
    const metricValues = new Map(
      insights.data.map((metric) => [metric.name, metric.total_value.value]),
    );
    const allMedia = isOverall
      ? await this.requestAllMedia(firstMediaPage, headers)
      : firstMediaPage.data;
    const selectedMedia =
      since === undefined
        ? allMedia
        : allMedia.filter((item) => Date.parse(item.timestamp) >= since * 1000);
    const analysisMedia = isOverall
      ? selectedMedia.map((item) => ({
          ...mapMedia(item),
          ...emptyMediaInsights(),
        }))
      : await this.enrichMedia(selectedMedia, accessToken);

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
      recentMedia: analysisMedia.slice(0, 6),
      analysisMedia,
    };
  }

  private async requestAllMedia(
    firstPage: z.infer<typeof mediaSchema>,
    headers: Record<string, string>,
  ): Promise<z.infer<typeof mediaSchema>['data']> {
    const media = [...firstPage.data];
    let next = firstPage.paging?.next;
    const visitedPages = new Set<string>();
    while (next && media.length < 500) {
      const nextUrl = new URL(next);
      if (
        nextUrl.origin !== 'https://graph.instagram.com' ||
        visitedPages.has(nextUrl.toString())
      ) {
        throw new InstagramAnalyticsProviderError(
          'Instagram returned an invalid pagination URL',
        );
      }
      visitedPages.add(nextUrl.toString());
      nextUrl.searchParams.delete('access_token');
      const page = await this.requestJson(nextUrl, mediaSchema, headers);
      media.push(...page.data.slice(0, 500 - media.length));
      next = page.paging?.next;
    }
    return media;
  }

  private async enrichMedia(
    media: z.infer<typeof mediaSchema>['data'],
    accessToken: string,
  ): Promise<InstagramAnalyticsProviderSnapshot['analysisMedia']> {
    const enriched: InstagramAnalyticsProviderSnapshot['analysisMedia'] = [];
    for (let index = 0; index < media.length; index += 4) {
      const batch = media.slice(index, index + 4);
      enriched.push(
        ...(await Promise.all(
          batch.map(async (item) => {
            const metrics = await this.requestMediaInsights(
              item.id,
              accessToken,
            );
            return {
              ...mapMedia(item),
              ...metrics,
            };
          }),
        )),
      );
    }
    return enriched;
  }

  private async requestMediaInsights(
    mediaId: string,
    accessToken: string,
  ): Promise<{
    views: number | null;
    reach: number | null;
    saved: number | null;
    shares: number | null;
    totalInteractions: number | null;
  }> {
    const url = new URL(
      `https://graph.instagram.com/${this.options.apiVersion}/${encodeURIComponent(mediaId)}/insights`,
    );
    url.searchParams.set(
      'metric',
      'views,reach,saved,shares,total_interactions',
    );
    try {
      const insights = await this.requestJson(url, mediaInsightsSchema, {
        Authorization: `Bearer ${accessToken}`,
      });
      const metrics = new Map(
        insights.data.map((metric) => [
          metric.name,
          metric.total_value?.value ?? metric.values?.at(-1)?.value ?? null,
        ]),
      );
      return {
        views: metrics.get('views') ?? null,
        reach: metrics.get('reach') ?? null,
        saved: metrics.get('saved') ?? null,
        shares: metrics.get('shares') ?? null,
        totalInteractions: metrics.get('total_interactions') ?? null,
      };
    } catch (error: unknown) {
      if (!(error instanceof InstagramAnalyticsProviderError)) throw error;
      return emptyMediaInsights();
    }
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

function emptyMediaInsights() {
  return {
    views: null,
    reach: null,
    saved: null,
    shares: null,
    totalInteractions: null,
  };
}

function mapMedia(
  item: z.infer<typeof mediaSchema>['data'][number],
): Omit<
  InstagramAnalyticsProviderSnapshot['analysisMedia'][number],
  'views' | 'reach' | 'saved' | 'shares' | 'totalInteractions'
> {
  return {
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
  };
}
