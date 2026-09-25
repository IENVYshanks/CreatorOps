import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstagramDashboard } from '../../features/analytics/instagram-dashboard';

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => navigation }));

const workspaceId = '7a53cb19-a18b-4fd4-bb5b-c9b881f90d41';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function analyticsResponse(rangeDays = 30) {
  return {
    rangeDays,
    profile: {
      username: 'creator',
      accountType: 'BUSINESS',
      followersCount: 12_480,
      mediaCount: 86,
      tokenExpiresAt: '2026-11-24T10:00:00.000Z',
    },
    metrics: {
      views: 18_420,
      reach: 11_760,
      accountsEngaged: 1284,
      totalInteractions: 2106,
    },
    recentMedia: [
      {
        id: 'media-1',
        caption: 'Launch day',
        mediaType: 'IMAGE',
        mediaProductType: 'FEED',
        mediaUrl: null,
        thumbnailUrl: null,
        permalink: 'https://www.instagram.com/p/example/',
        timestamp: '2026-09-24T10:00:00.000Z',
        likeCount: 42,
        commentsCount: 3,
        views: 540,
        reach: 410,
        saved: 12,
        shares: 8,
        totalInteractions: 65,
      },
    ],
    overall: null,
    analysis: {
      status: 'ready',
      sampleSize: 8,
      summary: 'Two actionable performance patterns were found.',
      patterns: [
        {
          type: 'format',
          title: 'Carousels are the strongest format',
          evidence: 'Carousels averaged 100% more interactions than videos.',
        },
      ],
      recommendations: [
        {
          title: 'Prioritize carousels',
          action: 'Publish two carousels in the next content cycle.',
          evidence: 'Carousels averaged 100% more interactions than videos.',
          confidence: 'high',
        },
      ],
    },
  };
}

describe('InstagramDashboard', () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(cleanup);

  it('shows KPIs and reloads when the range changes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(analyticsResponse()))
      .mockResolvedValueOnce(jsonResponse(analyticsResponse(7)));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<InstagramDashboard workspaceId={workspaceId} />);

    expect(
      await screen.findByRole('heading', { name: '@creator' }),
    ).toBeInTheDocument();
    expect(screen.getByText('18K')).toBeInTheDocument();
    expect(screen.getByText('Launch day')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Outreach recommendations' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Prioritize carousels')).toBeInTheDocument();
    expect(screen.getByText('8 posts analyzed')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Date range'), '7');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/workspaces/${workspaceId}/analytics/instagram?rangeDays=7`,
        expect.any(Object),
      );
    });
  });

  it('shows a connection action when Instagram is not connected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'INSTAGRAM_NOT_CONNECTED',
              message: 'Instagram is not connected',
            },
          },
          404,
        ),
      ),
    );

    render(<InstagramDashboard workspaceId={workspaceId} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Connect an Instagram professional account',
    );
    expect(
      screen.getByRole('link', { name: 'Manage connection' }),
    ).toHaveAttribute('href', `/workspaces/${workspaceId}`);
  });

  it('loads all available history when Overall is selected', async () => {
    const overallResponse = {
      ...analyticsResponse(),
      rangeDays: 'overall',
      metrics: {
        views: null,
        reach: null,
        accountsEngaged: null,
        totalInteractions: null,
      },
      overall: {
        analyzedMediaCount: 86,
        totalMediaCount: 86,
        coverageComplete: true,
        oldestMediaAt: '2022-01-01T10:00:00.000Z',
        newestMediaAt: '2026-09-24T10:00:00.000Z',
        totalLikes: 12_400,
        totalComments: 830,
        totalVisibleInteractions: 13_230,
        averageVisibleInteractionsPerPost: 153.84,
        strongestFormat: {
          mediaType: 'CAROUSEL_ALBUM',
          postCount: 24,
          averageVisibleInteractions: 210,
        },
        topMedia: analyticsResponse().recentMedia,
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(analyticsResponse()))
      .mockResolvedValueOnce(jsonResponse(overallResponse));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<InstagramDashboard workspaceId={workspaceId} />);
    await screen.findByRole('heading', { name: '@creator' });
    await user.selectOptions(screen.getByLabelText('Date range'), 'overall');

    expect(
      await screen.findByRole('heading', {
        name: 'Overall content performance',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('86 of 86 posts')).toBeInTheDocument();
    expect(screen.getByText('Complete available history')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/workspaces/${workspaceId}/analytics/instagram?rangeDays=overall`,
      expect.any(Object),
    );
  });

  it('explains when there is not enough content to recommend a change', async () => {
    const response = analyticsResponse();
    response.analysis = {
      status: 'insufficient_data',
      sampleSize: 2,
      summary: 'At least 4 posts are needed; 2 available.',
      patterns: [],
      recommendations: [],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(response)));

    render(<InstagramDashboard workspaceId={workspaceId} />);

    expect(await screen.findByText('2 posts analyzed')).toBeInTheDocument();
    expect(
      screen.getByText(/check again when this range contains at least four/i),
    ).toBeInTheDocument();
  });

  it('redirects an unauthenticated user to login', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
            401,
          ),
        ),
    );

    render(<InstagramDashboard workspaceId={workspaceId} />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/login');
    });
  });
});
