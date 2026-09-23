import { z } from 'zod';

const localDatabaseUrl =
  'postgresql://creator_ops:creator_ops@127.0.0.1:5432/creator_ops';

const environmentSchema = z
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

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  return environmentSchema.parse(source);
}
