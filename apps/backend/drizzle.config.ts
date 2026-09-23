import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://creator_ops:creator_ops@127.0.0.1:5432/creator_ops',
  },
  strict: true,
  verbose: true,
});
