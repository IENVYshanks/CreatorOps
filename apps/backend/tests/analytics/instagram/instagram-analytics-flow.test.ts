import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import {
  InstagramAnalyticsProviderError,
  type InstagramAnalyticsProvider,
} from '../../../src/modules/analytics/instagram/providers/instagram-analytics-provider.js';
import { MetaInstagramAnalyticsProvider } from '../../../src/modules/analytics/instagram/providers/meta-instagram-analytics-provider.js';
import { createInstagramAnalyticsRoutes } from '../../../src/modules/analytics/instagram/routes/instagram-analytics-routes.js';
import {
  InstagramAnalyticsService,
  type InstagramAuthorizedAccountAccess,
} from '../../../src/modules/analytics/instagram/services/instagram-analytics-service.js';
import { ApplicationError } from '../../../src/shared/application-error.js';

const userId = 'a58cb521-0d85-43d1-9854-d72f928d5d3d';
const workspaceId = '7a53cb19-a18b-4fd4-bb5b-c9b881f90d41';

const snapshot = {
  profile: {
    username: 'creator',
    accountType: 'BUSINESS',
    followersCount: 1200,
    mediaCount: 32,
  },
  metrics: {
    views: 9000,
    reach: 7200,
    accountsEngaged: 640,
    totalInteractions: 830,
  },
  recentMedia: [],
  analysisMedia: [],
};

function createService(provider: InstagramAnalyticsProvider) {
  const getAuthorizedAccount = vi.fn().mockResolvedValue({
    accountId: '17841400000000000',
    username: 'creator',
    accessToken: 'secret-access-token',
    accessTokenExpiresAt: new Date('2026-11-24T10:00:00.000Z'),
  });
  const accounts: InstagramAuthorizedAccountAccess = {
    getAuthorizedAccount,
  };
  return {
    getAuthorizedAccount,
    service: new InstagramAnalyticsService(accounts, provider),
  };
}

function createRouteApp(
  service: InstagramAnalyticsService,
  authenticated = true,
) {
  const app = express();
  const requireAuthentication: RequestHandler = (_request, response, next) => {
    if (!authenticated) {
      response.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
      return;
    }
    response.locals.user = { id: userId, email: 'creator@example.com' };
    next();
  };
  app.use(createInstagramAnalyticsRoutes(service, requireAuthentication));
  const errorHandler: ErrorRequestHandler = (error, _req, response, _next) => {
    if (error instanceof ApplicationError) {
      response.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    if (error instanceof ZodError) {
      response.status(400).json({ error: { code: 'VALIDATION_ERROR' } });
      return;
    }
    response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
  };
  app.use(errorHandler);
  return app;
}

describe('Instagram analytics', () => {
  it('fetches Meta data without putting the access token in URLs', async () => {
    const requestMock = vi.fn((input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.searchParams.has('access_token')).toBe(false);
      expect(init?.headers).toEqual({
        Authorization: 'Bearer secret-access-token',
      });

      if (url.pathname.endsWith('/media')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  id: 'media-1',
                  caption: 'Launch day',
                  media_type: 'IMAGE',
                  media_product_type: 'FEED',
                  media_url: 'https://cdn.example.com/media.jpg',
                  permalink: 'https://www.instagram.com/p/example/',
                  timestamp: '2026-09-24T10:00:00+0000',
                  like_count: 42,
                  comments_count: 3,
                },
              ],
            }),
          ),
        );
      }

      if (url.pathname.endsWith('/media-1/insights')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                { name: 'views', values: [{ value: 540 }] },
                { name: 'reach', values: [{ value: 410 }] },
                { name: 'saved', values: [{ value: 12 }] },
                { name: 'shares', values: [{ value: 8 }] },
                { name: 'total_interactions', values: [{ value: 65 }] },
              ],
            }),
          ),
        );
      }

      if (url.pathname.endsWith('/insights')) {
        expect(url.searchParams.get('since')).toBe('1787616000');
        expect(url.searchParams.get('until')).toBe('1790208000');
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                { name: 'views', total_value: { value: 9000 } },
                { name: 'reach', total_value: { value: 7200 } },
              ],
            }),
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: '17841400000000000',
            username: 'creator',
            account_type: 'BUSINESS',
            followers_count: 1200,
            media_count: 32,
          }),
        ),
      );
    });
    const provider = new MetaInstagramAnalyticsProvider({
      apiVersion: 'v26.0',
      fetch: requestMock as typeof fetch,
      now: () => new Date('2026-09-24T00:00:00.000Z'),
    });

    const result = await provider.getDashboard(
      '17841400000000000',
      'secret-access-token',
      30,
    );

    expect(requestMock).toHaveBeenCalledTimes(4);
    expect(result.metrics).toEqual({
      views: 9000,
      reach: 7200,
      accountsEngaged: null,
      totalInteractions: null,
    });
    expect(result.recentMedia[0]).toMatchObject({
      id: 'media-1',
      caption: 'Launch day',
      likeCount: 42,
      commentsCount: 3,
      thumbnailUrl: null,
      timestamp: '2026-09-24T10:00:00.000Z',
      views: 540,
      reach: 410,
      saved: 12,
      shares: 8,
      totalInteractions: 65,
    });
  });

  it('returns analytics through the authenticated workspace route', async () => {
    const provider: InstagramAnalyticsProvider = {
      getDashboard: vi.fn().mockResolvedValue(snapshot),
    };
    const { getAuthorizedAccount, service } = createService(provider);
    const response = await request(createRouteApp(service)).get(
      `/workspaces/${workspaceId}/analytics/instagram?rangeDays=7`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      rangeDays: 7,
      profile: {
        username: 'creator',
        tokenExpiresAt: '2026-11-24T10:00:00.000Z',
      },
      metrics: { views: 9000 },
      overall: null,
      analysis: { status: 'insufficient_data', sampleSize: 0 },
    });
    expect(getAuthorizedAccount).toHaveBeenCalledWith(userId, workspaceId);
    expect(JSON.stringify(response.body)).not.toContain('secret-access-token');
  });

  it('returns an all-available-history overview when overall is selected', async () => {
    const provider: InstagramAnalyticsProvider = {
      getDashboard: vi.fn().mockResolvedValue(snapshot),
    };
    const { service } = createService(provider);

    const response = await request(createRouteApp(service)).get(
      `/workspaces/${workspaceId}/analytics/instagram?rangeDays=overall`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      rangeDays: 'overall',
      overall: {
        analyzedMediaCount: 0,
        totalMediaCount: 32,
        coverageComplete: false,
      },
    });
  });

  it('keeps media available when Meta cannot provide its insights', async () => {
    const requestMock = vi.fn((input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/legacy-media/insights')) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: 100 } }), {
            status: 400,
          }),
        );
      }
      if (url.pathname.endsWith('/media')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  id: 'legacy-media',
                  media_type: 'IMAGE',
                  permalink: 'https://www.instagram.com/p/legacy/',
                  timestamp: '2026-09-23T10:00:00+0000',
                  like_count: 20,
                  comments_count: 2,
                },
              ],
            }),
          ),
        );
      }
      if (url.pathname.endsWith('/insights')) {
        return Promise.resolve(new Response(JSON.stringify({ data: [] })));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            username: 'creator',
            account_type: 'BUSINESS',
            followers_count: 1200,
            media_count: 32,
          }),
        ),
      );
    });
    const provider = new MetaInstagramAnalyticsProvider({
      apiVersion: 'v26.0',
      fetch: requestMock as typeof fetch,
      now: () => new Date('2026-09-24T00:00:00.000Z'),
    });

    const result = await provider.getDashboard('account', 'token', 7);

    expect(result.recentMedia[0]).toMatchObject({
      id: 'legacy-media',
      likeCount: 20,
      commentsCount: 2,
      views: null,
      reach: null,
      totalInteractions: null,
    });
  });

  it('paginates available media for the overall range without requesting lifetime insights', async () => {
    const requestMock = vi.fn((input: string | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.has('access_token')).toBe(false);
      if (url.pathname.endsWith('/media') && url.searchParams.has('after')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                mediaResponseItem('older-media', '2025-01-01T10:00:00+0000'),
              ],
            }),
          ),
        );
      }
      if (url.pathname.endsWith('/media')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                mediaResponseItem('newer-media', '2026-01-01T10:00:00+0000'),
              ],
              paging: {
                next: 'https://graph.instagram.com/v26.0/account/media?after=cursor&access_token=must-be-removed',
              },
            }),
          ),
        );
      }
      if (url.pathname.endsWith('/insights')) {
        throw new Error('Overall must not request lifetime insights');
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            username: 'creator',
            account_type: 'BUSINESS',
            followers_count: 1200,
            media_count: 2,
          }),
        ),
      );
    });
    const provider = new MetaInstagramAnalyticsProvider({
      apiVersion: 'v26.0',
      fetch: requestMock as typeof fetch,
    });

    const result = await provider.getDashboard('account', 'token', 'overall');

    expect(requestMock).toHaveBeenCalledTimes(3);
    expect(result.metrics).toEqual({
      views: null,
      reach: null,
      accountsEngaged: null,
      totalInteractions: null,
    });
    expect(result.analysisMedia.map((item) => item.id)).toEqual([
      'newer-media',
      'older-media',
    ]);
  });

  it('rejects unsupported ranges and unauthenticated requests', async () => {
    const provider: InstagramAnalyticsProvider = {
      getDashboard: vi.fn().mockResolvedValue(snapshot),
    };
    const { service } = createService(provider);

    const invalid = await request(createRouteApp(service)).get(
      `/workspaces/${workspaceId}/analytics/instagram?rangeDays=14`,
    );
    const unauthenticated = await request(createRouteApp(service, false)).get(
      `/workspaces/${workspaceId}/analytics/instagram`,
    );

    expect(invalid.status).toBe(400);
    expect(unauthenticated.status).toBe(401);
  });

  it('maps provider failures to a stable API error', async () => {
    const provider: InstagramAnalyticsProvider = {
      getDashboard: vi
        .fn()
        .mockRejectedValue(
          new InstagramAnalyticsProviderError('private detail'),
        ),
    };
    const { service } = createService(provider);
    const response = await request(createRouteApp(service)).get(
      `/workspaces/${workspaceId}/analytics/instagram`,
    );

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: {
        code: 'INSTAGRAM_ANALYTICS_UNAVAILABLE',
        message: 'Instagram analytics are temporarily unavailable',
      },
    });
  });
});

function mediaResponseItem(id: string, timestamp: string) {
  return {
    id,
    media_type: 'IMAGE',
    permalink: `https://www.instagram.com/p/${id}/`,
    timestamp,
    like_count: 20,
    comments_count: 2,
  };
}
