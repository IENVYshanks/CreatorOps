import { z } from 'zod';

const localDatabaseUrl =
  'postgresql://creator_ops:creator_ops@127.0.0.1:5432/creator_ops';

const applicationEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url().default(localDatabaseUrl),
    APP_ORIGIN: z.url().default('http://localhost:3000'),
    SESSION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 30)
      .default(168),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV !== 'production') {
      return;
    }

    if (environment.DATABASE_URL === localDatabaseUrl) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'Production must provide a non-development database URL',
      });
    }

    if (new URL(environment.APP_ORIGIN).protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['APP_ORIGIN'],
        message: 'Production application origin must use HTTPS',
      });
    }
  });

const instagramEnvironmentSchema = z.discriminatedUnion('INSTAGRAM_PROVIDER', [
  z.object({
    INSTAGRAM_PROVIDER: z.literal('disabled').default('disabled'),
  }),
  z.object({
    INSTAGRAM_PROVIDER: z.literal('mock'),
  }),
  z.object({
    INSTAGRAM_PROVIDER: z.literal('meta'),
    INSTAGRAM_APP_ID: z.string().min(1),
    INSTAGRAM_APP_SECRET: z.string().min(1),
    INSTAGRAM_REDIRECT_URI: z.url(),
    INSTAGRAM_API_VERSION: z.string().regex(/^v\d+\.\d+$/),
    CONNECTION_TOKEN_ENCRYPTION_KEY: z.string().refine((value) => {
      try {
        return Buffer.from(value, 'base64').length === 32;
      } catch {
        return false;
      }
    }, 'Token encryption key must be a base64-encoded 32-byte value'),
  }),
]);

const environmentSchema = applicationEnvironmentSchema
  .and(instagramEnvironmentSchema)
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      environment.INSTAGRAM_PROVIDER === 'mock'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['INSTAGRAM_PROVIDER'],
        message: 'The mock Instagram provider cannot run in production',
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  return environmentSchema.parse(source);
}
