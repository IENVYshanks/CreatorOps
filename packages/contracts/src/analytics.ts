import { z } from 'zod';

export const instagramAnalyticsRangeSchema = z
  .enum(['7', '30', '90', 'overall'])
  .transform((value): 7 | 30 | 90 | 'overall' =>
    value === 'overall' ? value : (Number(value) as 7 | 30 | 90),
  );

export const instagramAnalyticsQuerySchema = z.object({
  rangeDays: instagramAnalyticsRangeSchema.default(30),
});

export const instagramAnalyticsMetricSchema = z
  .number()
  .int()
  .nonnegative()
  .nullable();

export const instagramAnalyticsMediaSchema = z.object({
  id: z.string().min(1),
  caption: z.string().nullable(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM']),
  mediaProductType: z.string().min(1).nullable(),
  mediaUrl: z.url().nullable(),
  thumbnailUrl: z.url().nullable(),
  permalink: z.url(),
  timestamp: z.iso.datetime(),
  likeCount: z.number().int().nonnegative(),
  commentsCount: z.number().int().nonnegative(),
  views: instagramAnalyticsMetricSchema,
  reach: instagramAnalyticsMetricSchema,
  saved: instagramAnalyticsMetricSchema,
  shares: instagramAnalyticsMetricSchema,
  totalInteractions: instagramAnalyticsMetricSchema,
});

export const instagramAnalyticsAnalysisSchema = z.object({
  status: z.enum(['ready', 'insufficient_data']),
  sampleSize: z.number().int().nonnegative(),
  summary: z.string().min(1),
  patterns: z
    .array(
      z.object({
        type: z.enum(['format', 'timing', 'momentum']),
        title: z.string().min(1),
        evidence: z.string().min(1),
      }),
    )
    .max(3),
  recommendations: z
    .array(
      z.object({
        title: z.string().min(1),
        action: z.string().min(1),
        evidence: z.string().min(1),
        confidence: z.enum(['medium', 'high']),
      }),
    )
    .max(3),
});

export const instagramOverallAnalyticsSchema = z.object({
  analyzedMediaCount: z.number().int().nonnegative(),
  totalMediaCount: z.number().int().nonnegative(),
  coverageComplete: z.boolean(),
  oldestMediaAt: z.iso.datetime().nullable(),
  newestMediaAt: z.iso.datetime().nullable(),
  totalLikes: z.number().int().nonnegative(),
  totalComments: z.number().int().nonnegative(),
  totalVisibleInteractions: z.number().int().nonnegative(),
  averageVisibleInteractionsPerPost: z.number().nonnegative().nullable(),
  strongestFormat: z
    .object({
      mediaType: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM']),
      postCount: z.number().int().positive(),
      averageVisibleInteractions: z.number().nonnegative(),
    })
    .nullable(),
  topMedia: z.array(instagramAnalyticsMediaSchema).max(3),
});

export const instagramAnalyticsResponseSchema = z.object({
  rangeDays: z.union([
    z.literal(7),
    z.literal(30),
    z.literal(90),
    z.literal('overall'),
  ]),
  profile: z.object({
    username: z.string().min(1),
    accountType: z.string().min(1),
    followersCount: z.number().int().nonnegative(),
    mediaCount: z.number().int().nonnegative(),
    tokenExpiresAt: z.iso.datetime().nullable(),
  }),
  metrics: z.object({
    views: instagramAnalyticsMetricSchema,
    reach: instagramAnalyticsMetricSchema,
    accountsEngaged: instagramAnalyticsMetricSchema,
    totalInteractions: instagramAnalyticsMetricSchema,
  }),
  recentMedia: z.array(instagramAnalyticsMediaSchema).max(6),
  overall: instagramOverallAnalyticsSchema.nullable(),
  analysis: instagramAnalyticsAnalysisSchema,
});

export type InstagramAnalyticsRange = z.infer<
  typeof instagramAnalyticsRangeSchema
>;
export type InstagramAnalyticsMedia = z.infer<
  typeof instagramAnalyticsMediaSchema
>;
export type InstagramAnalyticsResponse = z.infer<
  typeof instagramAnalyticsResponseSchema
>;
export type InstagramAnalyticsAnalysis = z.infer<
  typeof instagramAnalyticsAnalysisSchema
>;
export type InstagramOverallAnalytics = z.infer<
  typeof instagramOverallAnalyticsSchema
>;
