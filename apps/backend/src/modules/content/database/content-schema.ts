import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from '../../identity/database/identity-database-schema.js';
import { workspaces } from '../../workspaces/workspace-database-schema.js';

export const contentItems = pgTable(
  'content_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 160 }).notNull(),
    body: text('body'),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('content_items_workspace_id_index').on(table.workspaceId),
    index('content_items_workspace_status_index').on(
      table.workspaceId,
      table.status,
    ),
  ],
);

export const contentVariants = pgTable(
  'content_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 32 }).notNull(),
    caption: text('caption').notNull(),
    mediaUrl: text('media_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('content_variants_item_platform_unique').on(
      table.contentItemId,
      table.platform,
    ),
  ],
);
