import { z } from 'zod';

import { emailSchema } from './auth.js';

export const userProfileSchema = z.object({
  id: z.uuid(),
  email: emailSchema,
  createdAt: z.iso.datetime(),
});

export const profileResponseSchema = z.object({
  profile: userProfileSchema,
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
