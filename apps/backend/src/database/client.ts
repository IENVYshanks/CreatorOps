import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';

export type AppDatabase = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  database: AppDatabase;
  close: () => Promise<void>;
}

export function createDatabaseConnection(
  connectionString: string,
): DatabaseConnection {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });

  return {
    database: drizzle(pool, { schema }),
    close: async () => pool.end(),
  };
}
