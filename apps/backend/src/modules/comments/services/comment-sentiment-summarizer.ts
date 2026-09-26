import type { CommentSentimentSummary } from '@creatorpilot/contracts';

import { classifyCommentSentiment } from './comment-sentiment-classifier.js';

export function summarizeCommentSentiments(
  comments: string[],
): CommentSentimentSummary {
  const summary: CommentSentimentSummary = {
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0,
    totalComments: 0,
  };

  for (const comment of comments) {
    const sentiment = classifyCommentSentiment(comment);

    if (sentiment === 'positive') summary.positiveCount += 1;
    if (sentiment === 'neutral') summary.neutralCount += 1;
    if (sentiment === 'negative') summary.negativeCount += 1;
    summary.totalComments += 1;
  }

  return summary;
}
