import type {
  InstagramAnalyticsAnalysis,
  InstagramAnalyticsMedia,
} from '@creatorpilot/contracts';

interface GroupPerformance {
  label: string;
  count: number;
  average: number;
}

export function analyzeInstagramOutreach(
  media: InstagramAnalyticsMedia[],
): InstagramAnalyticsAnalysis {
  if (media.length < 4) {
    return {
      status: 'insufficient_data',
      sampleSize: media.length,
      summary: `At least 4 posts are needed for reliable recommendations; ${String(media.length)} available.`,
      patterns: [],
      recommendations: [],
    };
  }

  const patterns: InstagramAnalyticsAnalysis['patterns'] = [];
  const recommendations: InstagramAnalyticsAnalysis['recommendations'] = [];
  const format = findWinningGroup(media, (item) => formatLabel(item.mediaType));
  if (format) {
    const lift = percentageLift(format.best.average, format.runnerUp.average);
    const evidence = `${format.best.label} averaged ${format.best.average.toFixed(1)} interactions across ${String(format.best.count)} posts, ${String(lift)}% above ${format.runnerUp.label}.`;
    patterns.push({
      type: 'format',
      title: `${format.best.label} perform best`,
      evidence,
    });
    recommendations.push({
      title: `Prioritize ${format.best.label.toLowerCase()}`,
      action: `Use ${format.best.label.toLowerCase()} for more of the next content cycle, then compare the result with the current baseline.`,
      evidence,
      confidence: confidenceFor(format.best, lift),
    });
  }

  const timing = findWinningGroup(media, (item) => timeBucket(item.timestamp));
  if (timing) {
    const lift = percentageLift(timing.best.average, timing.runnerUp.average);
    const evidence = `${timing.best.label} posts averaged ${timing.best.average.toFixed(1)} interactions across ${String(timing.best.count)} posts, ${String(lift)}% above ${timing.runnerUp.label}.`;
    patterns.push({
      type: 'timing',
      title: `${timing.best.label} posts perform best`,
      evidence,
    });
    recommendations.push({
      title: `Test more ${timing.best.label.toLowerCase()} posts`,
      action: `Schedule two comparable posts in the ${timing.best.label.toLowerCase()} window and measure whether the advantage continues.`,
      evidence,
      confidence: confidenceFor(timing.best, lift),
    });
  }

  const momentum = analyzeMomentum(media);
  if (momentum) {
    patterns.push({
      type: 'momentum',
      title: momentum.title,
      evidence: momentum.evidence,
    });
    recommendations.push({
      title: momentum.recommendationTitle,
      action: momentum.action,
      evidence: momentum.evidence,
      confidence: media.length >= 10 ? 'high' : 'medium',
    });
  }

  return {
    status: 'ready',
    sampleSize: media.length,
    summary:
      patterns.length === 0
        ? `No performance difference of at least 15% was found across ${String(media.length)} posts.`
        : `${String(patterns.length)} actionable performance ${patterns.length === 1 ? 'pattern was' : 'patterns were'} found across ${String(media.length)} posts.`,
    patterns: patterns.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };
}

function findWinningGroup(
  media: InstagramAnalyticsMedia[],
  groupFor: (media: InstagramAnalyticsMedia) => string,
): { best: GroupPerformance; runnerUp: GroupPerformance } | undefined {
  const groups = new Map<string, number[]>();
  for (const item of media) {
    const label = groupFor(item);
    groups.set(label, [...(groups.get(label) ?? []), interactionScore(item)]);
  }
  const ranked = [...groups.entries()]
    .filter(([, scores]) => scores.length >= 2)
    .map(([label, scores]) => ({
      label,
      count: scores.length,
      average: average(scores),
    }))
    .sort((left, right) => right.average - left.average);
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (
    !best ||
    !runnerUp ||
    percentageLift(best.average, runnerUp.average) < 15
  ) {
    return undefined;
  }
  return { best, runnerUp };
}

function analyzeMomentum(media: InstagramAnalyticsMedia[]):
  | {
      title: string;
      evidence: string;
      recommendationTitle: string;
      action: string;
    }
  | undefined {
  if (media.length < 6) return undefined;
  const ordered = [...media].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );
  const split = Math.floor(ordered.length / 2);
  const olderAverage = average(ordered.slice(0, split).map(interactionScore));
  const recentAverage = average(ordered.slice(-split).map(interactionScore));
  const lift = percentageLift(recentAverage, olderAverage);
  if (Math.abs(lift) < 15) return undefined;
  const direction = lift > 0 ? 'up' : 'down';
  const evidence = `Recent posts averaged ${recentAverage.toFixed(1)} interactions versus ${olderAverage.toFixed(1)} previously, a ${String(Math.abs(lift))}% ${direction === 'up' ? 'increase' : 'decrease'}.`;
  return direction === 'up'
    ? {
        title: 'Recent content momentum is improving',
        evidence,
        recommendationTitle: 'Continue the recent content direction',
        action:
          'Repeat the formats and publishing approach used in the stronger recent half while monitoring the next posts.',
      }
    : {
        title: 'Recent content momentum is declining',
        evidence,
        recommendationTitle: 'Revisit the earlier winning approach',
        action:
          'Compare recent posts with the stronger earlier half and restore the formats or timing that changed.',
      };
}

function interactionScore(media: InstagramAnalyticsMedia): number {
  return media.totalInteractions ?? media.likeCount + media.commentsCount;
}

function formatLabel(type: InstagramAnalyticsMedia['mediaType']): string {
  if (type === 'CAROUSEL_ALBUM') return 'Carousels';
  if (type === 'VIDEO') return 'Videos';
  return 'Images';
}

function timeBucket(timestamp: string): string {
  const hour = new Date(timestamp).getUTCHours();
  if (hour < 12) return 'Morning (UTC)';
  if (hour < 17) return 'Afternoon (UTC)';
  return 'Evening (UTC)';
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentageLift(value: number, baseline: number): number {
  if (baseline === 0) return value === 0 ? 0 : 100;
  return Math.round(((value - baseline) / baseline) * 100);
}

function confidenceFor(
  group: GroupPerformance,
  lift: number,
): 'medium' | 'high' {
  return group.count >= 4 && lift >= 30 ? 'high' : 'medium';
}
