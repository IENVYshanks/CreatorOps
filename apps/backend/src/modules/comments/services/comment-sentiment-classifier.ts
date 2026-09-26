import type { CommentSentiment } from '@creatorpilot/contracts';

const positiveWords = new Set([
  'amazing',
  'awesome',
  'beautiful',
  'excellent',
  'good',
  'great',
  'helpful',
  'love',
  'nice',
  'perfect',
  'thanks',
  'wonderful',
]);

const negativeWords = new Set([
  'awful',
  'bad',
  'boring',
  'disappointing',
  'hate',
  'horrible',
  'poor',
  'spam',
  'terrible',
  'ugly',
  'worst',
]);

const negationWords = new Set([
  "can't",
  'cannot',
  "didn't",
  "doesn't",
  "don't",
  "isn't",
  'never',
  'no',
  'not',
  "wasn't",
]);

const positiveEmojis = ['❤', '😍', '🥰', '😊', '😁', '🔥', '👏', '👍'];
const negativeEmojis = ['😡', '😠', '😢', '😭', '👎', '💔', '🤮'];

export function classifyCommentSentiment(comment: string): CommentSentiment {
  const words = comment.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
  let score = emojiScore(comment);

  for (const [index, word] of words.entries()) {
    const wordScore = positiveWords.has(word)
      ? 1
      : negativeWords.has(word)
        ? -1
        : 0;

    if (wordScore === 0) continue;

    const precedingWords = words.slice(Math.max(0, index - 2), index);
    const isNegated = precedingWords.some((candidate) =>
      negationWords.has(candidate),
    );
    score += isNegated ? -wordScore : wordScore;
  }

  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

function emojiScore(comment: string): number {
  const normalizedComment = comment.replaceAll('\uFE0F', '');
  const positiveScore = positiveEmojis.reduce(
    (score, emoji) => score + countOccurrences(normalizedComment, emoji),
    0,
  );
  const negativeScore = negativeEmojis.reduce(
    (score, emoji) => score + countOccurrences(normalizedComment, emoji),
    0,
  );

  return positiveScore - negativeScore;
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}
