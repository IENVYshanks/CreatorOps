import type {
  InstagramAnalyticsMedia,
  InstagramOverallAnalytics,
} from '@creatorpilot/contracts';

export function analyzeOverallInstagramMedia(
  media: InstagramAnalyticsMedia[],
  totalMediaCount: number,
): InstagramOverallAnalytics {
  const totalLikes = sum(media.map((item) => item.likeCount));
  const totalComments = sum(media.map((item) => item.commentsCount));
  const visibleInteractions = media.map(
    (item) => item.likeCount + item.commentsCount,
  );
  const ordered = [...media].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );

  return {
    analyzedMediaCount: media.length,
    totalMediaCount,
    coverageComplete: media.length >= totalMediaCount,
    oldestMediaAt: ordered[0]?.timestamp ?? null,
    newestMediaAt: ordered.at(-1)?.timestamp ?? null,
    totalLikes,
    totalComments,
    totalVisibleInteractions: totalLikes + totalComments,
    averageVisibleInteractionsPerPost:
      visibleInteractions.length === 0
        ? null
        : round(sum(visibleInteractions) / visibleInteractions.length),
    strongestFormat: findStrongestFormat(media),
    topMedia: [...media]
      .sort(
        (left, right) =>
          right.likeCount +
          right.commentsCount -
          (left.likeCount + left.commentsCount),
      )
      .slice(0, 3),
  };
}

function findStrongestFormat(
  media: InstagramAnalyticsMedia[],
): InstagramOverallAnalytics['strongestFormat'] {
  const groups = new Map<InstagramAnalyticsMedia['mediaType'], number[]>();
  for (const item of media) {
    groups.set(item.mediaType, [
      ...(groups.get(item.mediaType) ?? []),
      item.likeCount + item.commentsCount,
    ]);
  }
  const strongest = [...groups.entries()]
    .map(([mediaType, interactions]) => ({
      mediaType,
      postCount: interactions.length,
      averageVisibleInteractions: round(
        sum(interactions) / interactions.length,
      ),
    }))
    .sort(
      (left, right) =>
        right.averageVisibleInteractions - left.averageVisibleInteractions,
    )[0];
  return strongest ?? null;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
