import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));

export const passwordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters')
  .max(128, 'Password must contain at most 128 characters');

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const authenticatedUserSchema = z.object({
  id: z.uuid(),
  email: emailSchema,
});

export const authSessionResponseSchema = z.object({
  user: authenticatedUserSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
