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
const ranges: InstagramAnalyticsRange[] = [7, 30, 90, 'overall'];

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
              Account-level results, content patterns, and evidence-based
              outreach recommendations.
            </p>
          </div>
          <label className="range-control">
            Date range
            <select
              aria-label="Date range"
              value={rangeDays}
              onChange={(event) => {
                setRangeDays(
                  event.target.value === 'overall'
                    ? 'overall'
                    : (Number(event.target.value) as InstagramAnalyticsRange),
                );
              }}
            >
              {ranges.map((range) => (
                <option key={range} value={range}>
                  {range === 'overall'
                    ? 'Overall'
                    : `Last ${String(range)} days`}
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
              className="outreach-analysis"
              aria-labelledby="outreach-analysis-heading"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Performance guidance</p>
                  <h2 id="outreach-analysis-heading">
                    Outreach recommendations
                  </h2>
                </div>
                <span className="sample-badge">
                  {analytics.analysis.sampleSize} posts analyzed
                </span>
              </div>
              <p className="analysis-summary">{analytics.analysis.summary}</p>
              {analytics.analysis.status === 'insufficient_data' ? (
                <p className="analytics-state">
                  Keep publishing and check again when this range contains at
                  least four posts.
                </p>
              ) : (
                <div className="analysis-grid">
                  <div className="pattern-list">
                    <h3>What is working</h3>
                    {analytics.analysis.patterns.length === 0 ? (
                      <p className="muted">
                        Performance is balanced across the tested formats and
                        times. Keep collecting data before changing direction.
                      </p>
                    ) : (
                      analytics.analysis.patterns.map((pattern) => (
                        <article
                          className="pattern-card"
                          key={`${pattern.type}-${pattern.title}`}
                        >
                          <span>{pattern.type}</span>
                          <h4>{pattern.title}</h4>
                          <p>{pattern.evidence}</p>
                        </article>
                      ))
                    )}
                  </div>
                  <div className="recommendation-list">
                    <h3>What to do next</h3>
                    {analytics.analysis.recommendations.length === 0 ? (
                      <p className="muted">
                        No change is recommended until a clearer advantage
                        appears.
                      </p>
                    ) : (
                      analytics.analysis.recommendations.map(
                        (recommendation) => (
                          <article
                            className="recommendation-card"
                            key={recommendation.title}
                          >
                            <div>
                              <h4>{recommendation.title}</h4>
                              <span>
                                {recommendation.confidence} confidence
                              </span>
                            </div>
                            <p>{recommendation.action}</p>
                            <small>{recommendation.evidence}</small>
                          </article>
                        ),
                      )
                    )}
                  </div>
                </div>
              )}
            </section>

            {analytics.overall ? (
              <OverallAnalytics overview={analytics.overall} />
            ) : (
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
            )}

            <section
              className="recent-media"
              aria-labelledby="recent-media-heading"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Content</p>
                  <h2 id="recent-media-heading">Recent media</h2>
                </div>
                <span className="muted">
                  {analytics.rangeDays === 'overall'
                    ? 'All available history'
                    : `Last ${String(analytics.rangeDays)} days`}
                </span>
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
                          {media.reach !== null || media.views !== null ? (
                            <div className="media-card-meta">
                              <span>
                                {media.reach === null
                                  ? 'Reach unavailable'
                                  : `${numberFormatter.format(media.reach)} reached`}
                              </span>
                              <span>
                                {media.views === null
                                  ? 'Views unavailable'
                                  : `${numberFormatter.format(media.views)} views`}
                              </span>
                            </div>
                          ) : null}
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

function OverallAnalytics({
  overview,
}: {
  overview: NonNullable<InstagramAnalyticsResponse['overall']>;
}) {
  const formatNames = {
    IMAGE: 'Images',
    VIDEO: 'Videos',
    CAROUSEL_ALBUM: 'Carousels',
  } as const;

  return (
    <section className="overall-analytics" aria-labelledby="overall-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">All available history</p>
          <h2 id="overall-heading">Overall content performance</h2>
        </div>
        <span className="sample-badge">
          {overview.analyzedMediaCount} of {overview.totalMediaCount} posts
        </span>
      </div>
      <p className="muted overall-note">
        Instagram does not provide lifetime account reach or views. These totals
        use the likes and comments visible on the posts analyzed.
      </p>
      <div className="overall-grid">
        <KpiCard label="Total likes" value={overview.totalLikes} />
        <KpiCard label="Total comments" value={overview.totalComments} />
        <KpiCard
          label="Visible interactions"
          value={overview.totalVisibleInteractions}
        />
        <KpiCard
          label="Average per post"
          value={overview.averageVisibleInteractionsPerPost}
        />
      </div>
      <div className="overall-details">
        <article>
          <span>Coverage</span>
          <strong>
            {overview.coverageComplete
              ? 'Complete available history'
              : 'Partial available history'}
          </strong>
          <p>
            {overview.oldestMediaAt && overview.newestMediaAt
              ? `${dateFormatter.format(new Date(overview.oldestMediaAt))}–${dateFormatter.format(new Date(overview.newestMediaAt))}`
              : 'No media dates available'}
          </p>
        </article>
        <article>
          <span>Strongest format</span>
          <strong>
            {overview.strongestFormat
              ? formatNames[overview.strongestFormat.mediaType]
              : 'Unavailable'}
          </strong>
          <p>
            {overview.strongestFormat
              ? `${numberFormatter.format(overview.strongestFormat.averageVisibleInteractions)} average visible interactions across ${String(overview.strongestFormat.postCount)} posts`
              : 'No posts available to compare'}
          </p>
        </article>
      </div>
      {overview.topMedia.length > 0 ? (
        <div className="top-media-list">
          <h3>Top posts by visible interactions</h3>
          {overview.topMedia.map((media, index) => (
            <a
              href={media.permalink}
              key={media.id}
              rel="noreferrer"
              target="_blank"
            >
              <span>#{String(index + 1)}</span>
              <strong>{media.caption ?? 'Untitled Instagram post'}</strong>
              <small>
                {numberFormatter.format(media.likeCount + media.commentsCount)}{' '}
                interactions
              </small>
            </a>
          ))}
        </div>
      ) : null}
    </section>
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
