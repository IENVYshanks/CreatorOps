'use client';

import type {
  InstagramAnalyticsRange,
  InstagramAnalyticsResponse,
} from '@creatorpilot/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiClientError, getInstagramAnalytics } from '../../lib/api';

const numberFormatter = new Intl.NumberFormat('en', { notation: 'compact' });
const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});
const ranges: InstagramAnalyticsRange[] = [7, 30, 90];

export interface InstagramDashboardProperties {
  workspaceId: string;
}

export function InstagramDashboard({
  workspaceId,
}: InstagramDashboardProperties) {
  const router = useRouter();
  const [rangeDays, setRangeDays] = useState<InstagramAnalyticsRange>(30);
  const [analytics, setAnalytics] = useState<InstagramAnalyticsResponse>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);

    void getInstagramAnalytics(workspaceId, rangeDays, controller.signal)
      .then((result) => {
        setAnalytics(result);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;

        if (caught instanceof ApiClientError && caught.status === 401) {
          router.replace('/login');
          return;
        }

        setAnalytics(undefined);
        if (
          caught instanceof ApiClientError &&
          caught.code === 'INSTAGRAM_NOT_CONNECTED'
        ) {
          setError(
            'Connect an Instagram professional account to see analytics.',
          );
        } else if (
          caught instanceof ApiClientError &&
          caught.code === 'INSTAGRAM_REAUTHORIZATION_REQUIRED'
        ) {
          setError('Reconnect Instagram to refresh access to analytics.');
        } else {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to load Instagram analytics',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [rangeDays, router, workspaceId]);

  return (
    <main className="analytics-shell">
      <div className="analytics-layout">
        <Link className="secondary-link" href={`/workspaces/${workspaceId}`}>
          Back to workspace
        </Link>

        <header className="analytics-header">
          <div>
            <p className="eyebrow">Instagram analytics</p>
            <h1>
              {analytics ? `@${analytics.profile.username}` : 'Performance'}
            </h1>
            <p className="muted">
              Account-level results and your six most recent posts.
            </p>
          </div>
          <label className="range-control">
            Date range
            <select
              aria-label="Date range"
              value={rangeDays}
              onChange={(event) => {
                setRangeDays(
                  Number(event.target.value) as InstagramAnalyticsRange,
                );
              }}
            >
              {ranges.map((range) => (
                <option key={range} value={range}>
                  Last {range} days
                </option>
              ))}
            </select>
          </label>
        </header>

        {loading ? (
          <p className="analytics-state">Loading analytics...</p>
        ) : null}
        {error ? (
          <section className="analytics-state" role="alert">
            <p>{error}</p>
            <Link className="primary-link" href={`/workspaces/${workspaceId}`}>
              Manage connection
            </Link>
          </section>
        ) : null}

        {!loading && analytics ? (
          <>
            <section className="analytics-profile" aria-label="Account summary">
              <div>
                <span>Account type</span>
                <strong>{analytics.profile.accountType}</strong>
              </div>
              <div>
                <span>Followers</span>
                <strong>
                  {numberFormatter.format(analytics.profile.followersCount)}
                </strong>
              </div>
              <div>
                <span>Published media</span>
                <strong>
                  {numberFormatter.format(analytics.profile.mediaCount)}
                </strong>
              </div>
            </section>

            <section
              className="kpi-grid"
              aria-label="Key performance indicators"
            >
              <KpiCard label="Views" value={analytics.metrics.views} />
              <KpiCard label="Reach" value={analytics.metrics.reach} />
              <KpiCard
                label="Accounts engaged"
                value={analytics.metrics.accountsEngaged}
              />
              <KpiCard
                label="Total interactions"
                value={analytics.metrics.totalInteractions}
              />
            </section>

            <section
              className="recent-media"
              aria-labelledby="recent-media-heading"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Content</p>
                  <h2 id="recent-media-heading">Recent media</h2>
                </div>
                <span className="muted">Last {analytics.rangeDays} days</span>
              </div>
              {analytics.recentMedia.length === 0 ? (
                <p className="analytics-state">
                  No recent media is available yet.
                </p>
              ) : (
                <div className="media-grid">
                  {analytics.recentMedia.map((media) => {
                    const previewUrl = media.thumbnailUrl ?? media.mediaUrl;
                    return (
                      <a
                        className="media-card"
                        href={media.permalink}
                        key={media.id}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {previewUrl ? (
                          <img
                            alt=""
                            className="media-preview"
                            src={previewUrl}
                          />
                        ) : (
                          <div className="media-preview media-preview--empty">
                            {media.mediaType}
                          </div>
                        )}
                        <div className="media-card-body">
                          <p>{media.caption ?? 'Untitled Instagram post'}</p>
                          <div className="media-card-meta">
                            <span>
                              {numberFormatter.format(media.likeCount)} likes
                            </span>
                            <span>
                              {numberFormatter.format(media.commentsCount)}{' '}
                              comments
                            </span>
                          </div>
                          <time dateTime={media.timestamp}>
                            {dateFormatter.format(new Date(media.timestamp))}
                          </time>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: number | null }) {
  return (
    <article className="kpi-card">
      <span>{label}</span>
      <strong>{value === null ? '—' : numberFormatter.format(value)}</strong>
    </article>
  );
}
