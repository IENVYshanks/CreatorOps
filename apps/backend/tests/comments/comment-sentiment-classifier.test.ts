import { describe, expect, it } from 'vitest';

import { classifyCommentSentiment } from '../../src/modules/comments/services/comment-sentiment-classifier.js';

describe('comment sentiment classifier', () => {
  it('classifies positive comments', () => {
    expect(classifyCommentSentiment('I love this beautiful post!')).toBe(
      'positive',
    );
  });

  it('classifies negative comments', () => {
    expect(classifyCommentSentiment('This is terrible and boring.')).toBe(
      'negative',
    );
  });

  it('classifies comments without sentiment words as neutral', () => {
    expect(classifyCommentSentiment('When was this posted?')).toBe('neutral');
  });

  it('classifies balanced positive and negative words as neutral', () => {
    expect(classifyCommentSentiment('Great idea, but terrible execution.')).toBe(
      'neutral',
    );
  });

  it('matches whole words instead of substrings', () => {
    expect(classifyCommentSentiment('I played badminton today.')).toBe(
      'neutral',
    );
  });

  it('reverses sentiment words preceded by a negation', () => {
    expect(classifyCommentSentiment('This is not very good.')).toBe('negative');
    expect(classifyCommentSentiment("This isn't terrible.")).toBe('positive');
  });

  it('classifies common reaction emojis', () => {
    expect(classifyCommentSentiment('This! 🔥👏')).toBe('positive');
    expect(classifyCommentSentiment('👎😡')).toBe('negative');
  });
});
