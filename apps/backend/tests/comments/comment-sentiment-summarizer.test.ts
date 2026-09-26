import { describe, expect, it } from 'vitest';

import { summarizeCommentSentiments } from '../../src/modules/comments/services/comment-sentiment-summarizer.js';

describe('comment sentiment summarizer', () => {
  it('counts each sentiment and the total number of comments', () => {
    const summary = summarizeCommentSentiments([
      'Amazing post!',
      'When was this posted?',
      'This is terrible.',
      'I love this!',
    ]);

    expect(summary).toEqual({
      positiveCount: 2,
      neutralCount: 1,
      negativeCount: 1,
      totalComments: 4,
    });
  });

  it('returns zero counts when there are no comments', () => {
    expect(summarizeCommentSentiments([])).toEqual({
      positiveCount: 0,
      neutralCount: 0,
      negativeCount: 0,
      totalComments: 0,
    });
  });
});
