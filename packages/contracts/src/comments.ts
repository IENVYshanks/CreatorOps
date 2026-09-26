import { z } from 'zod';

export const commentSentimentSchema = z.enum([
  'positive',
  'neutral',
  'negative',
]);

export const commentSentimentSummarySchema = z.object({
  positiveCount: z.number().int().nonnegative(),
  neutralCount: z.number().int().nonnegative(),
  negativeCount: z.number().int().nonnegative(),
  totalComments: z.number().int().nonnegative(),
});

export type CommentSentiment = z.infer<typeof commentSentimentSchema>;
export type CommentSentimentSummary = z.infer<
  typeof commentSentimentSummarySchema
>;
