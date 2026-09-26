import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { workspaces } from '../../workspaces/workspace-database-schema.js';

export const instagramPostSentiments = pgTable(
  'instagram_post_sentiments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    instagramPostId: varchar('instagram_post_id', { length: 255 }).notNull(),
    postPublishedAt: timestamp('post_published_at', {
      withTimezone: true,
    }).notNull(),
    positiveCount: integer('positive_count').notNull(),
    neutralCount: integer('neutral_count').notNull(),
    negativeCount: integer('negative_count').notNull(),
    totalComments: integer('total_comments').notNull(),
    analyzedAt: timestamp('analyzed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('instagram_post_sentiments_workspace_post_unique').on(
      table.workspaceId,
      table.instagramPostId,
    ),
    index('instagram_post_sentiments_workspace_published_index').on(
      table.workspaceId,
      table.postPublishedAt,
    ),
    check(
      'instagram_post_sentiments_counts_nonnegative',
      sql`${table.positiveCount} >= 0 AND ${table.neutralCount} >= 0 AND ${table.negativeCount} >= 0`,
    ),
    check(
      'instagram_post_sentiments_total_matches_counts',
      sql`${table.totalComments} = ${table.positiveCount} + ${table.neutralCount} + ${table.negativeCount}`,
    ),
  ],
);
