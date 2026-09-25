import { z } from 'zod';

export const instagramAnalyticsRangeSchema = z
  .enum(['7', '30', '90'])
  .transform((value): 7 | 30 | 90 => Number(value) as 7 | 30 | 90);

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
});

export const instagramAnalyticsResponseSchema = z.object({
  rangeDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
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
