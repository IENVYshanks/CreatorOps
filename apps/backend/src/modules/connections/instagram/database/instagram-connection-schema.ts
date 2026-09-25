import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from '../../../identity/database/identity-database-schema.js';
import { workspaces } from '../../../workspaces/workspace-database-schema.js';

export const platformConnections = pgTable(
  'platform_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 32 }).notNull(),
    providerAccountId: varchar('provider_account_id', {
      length: 255,
    }).notNull(),
    username: varchar('username', { length: 255 }).notNull(),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    accessTokenInitializationVector: varchar('access_token_iv', {
      length: 64,
    }).notNull(),
    accessTokenAuthenticationTag: varchar('access_token_auth_tag', {
      length: 64,
    }).notNull(),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    connectedAt: timestamp('connected_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('platform_connections_workspace_platform_unique').on(
      table.workspaceId,
      table.platform,
    ),
    index('platform_connections_workspace_id_index').on(table.workspaceId),
  ],
);

export const connectionOAuthStates = pgTable(
  'connection_oauth_states',
  {
    stateHash: varchar('state_hash', { length: 64 }).primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    initiatedByUserId: uuid('initiated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('connection_oauth_states_expires_at_index').on(table.expiresAt),
  ],
);
