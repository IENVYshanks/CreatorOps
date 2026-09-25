import { z } from 'zod';

export const platformSchema = z.enum(['instagram']);

export const platformConnectionSchema = z.object({
  id: z.uuid(),
  platform: platformSchema,
  accountId: z.string().min(1),
  username: z.string().min(1),
  connectedAt: z.iso.datetime(),
});

export const platformConnectionListResponseSchema = z.object({
  connections: z.array(platformConnectionSchema),
});

export const instagramAuthorizationResponseSchema = z.object({
  authorizationUrl: z.url(),
});

export const instagramCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export type Platform = z.infer<typeof platformSchema>;
export type PlatformConnection = z.infer<typeof platformConnectionSchema>;
export type PlatformConnectionListResponse = z.infer<
  typeof platformConnectionListResponseSchema
>;
export type InstagramAuthorizationResponse = z.infer<
  typeof instagramAuthorizationResponseSchema
>;
