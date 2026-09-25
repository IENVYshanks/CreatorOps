import { readFile } from 'node:fs/promises';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createDatabaseConnection,
  type DatabaseConnection,
} from '../../src/database/client.js';
import { PostgresInstagramConnectionRepository } from '../../src/modules/connections/instagram/repositories/postgres-instagram-connection-repository.js';
import { PostgresContentRepository } from '../../src/modules/content/repositories/postgres-content-repository.js';
import { PostgresAuthRepository } from '../../src/modules/identity/database/postgres-auth-repository.js';
import { PostgresWorkspaceRepository } from '../../src/modules/workspaces/postgres-workspace-repository.js';

describe('PostgreSQL repositories', () => {
  let connection: DatabaseConnection;
  let maintenancePool: Pool;
  let stopContainer: () => Promise<void>;

  beforeAll(async () => {
    const container = await new PostgreSqlContainer(
      'postgres:17-alpine',
    ).start();
    stopContainer = async () => container.stop().then(() => undefined);
    maintenancePool = new Pool({
      connectionString: container.getConnectionUri(),
    });

    for (const migrationName of [
      '0000_dizzy_khan.sql',
      '0001_instagram_connections.sql',
      '0002_content_drafts.sql',
    ]) {
      const migration = await readFile(
        new URL(`../../drizzle/${migrationName}`, import.meta.url),
        'utf8',
      );
      await maintenancePool.query(migration);
    }
    connection = createDatabaseConnection(container.getConnectionUri());
  }, 120_000);

  beforeEach(async () => {
    await maintenancePool.query(
      'TRUNCATE connection_oauth_states, platform_connections, workspace_memberships, workspaces, sessions, users CASCADE',
    );
  });

  afterAll(async () => {
    await connection.close();
    await maintenancePool.end();
    await stopContainer();
  });

  it('persists users and resolves only live sessions', async () => {
    const repository = new PostgresAuthRepository(connection.database);
    const user = await repository.createUser('creator@example.com', 'hash');

    expect(user).toMatchObject({ email: 'creator@example.com' });
    if (!user) {
      throw new Error('Expected the user to be created');
    }
    expect(
      await repository.createUser('creator@example.com', 'hash'),
    ).toBeUndefined();

    await repository.createSession(
      user.id,
      'a'.repeat(64),
      new Date(Date.now() + 60_000),
    );
    expect(
      await repository.findUserBySession('a'.repeat(64), new Date()),
    ).toMatchObject({ id: user.id });
    expect(
      await repository.findUserBySession(
        'a'.repeat(64),
        new Date(Date.now() + 120_000),
      ),
    ).toBeUndefined();
  });

  it('creates an owner membership atomically and isolates tenants', async () => {
    const identities = new PostgresAuthRepository(connection.database);
    const workspaces = new PostgresWorkspaceRepository(connection.database);
    const firstUser = await identities.createUser('first@example.com', 'hash');
    const secondUser = await identities.createUser(
      'second@example.com',
      'hash',
    );

    if (!firstUser || !secondUser) {
      throw new Error('Expected both users to be created');
    }

    const created = await workspaces.createOwnedWorkspace(
      firstUser.id,
      'First Studio',
    );

    expect(created.role).toBe('owner');
    expect(await workspaces.listForUser(firstUser.id)).toEqual([created]);
    expect(await workspaces.listForUser(secondUser.id)).toEqual([]);
    expect(
      await workspaces.findForUser(firstUser.id, created.id),
    ).toMatchObject(created);
    expect(
      await workspaces.findForUser(secondUser.id, created.id),
    ).toBeUndefined();
    expect(
      await workspaces.listMembersForUser(firstUser.id, created.id),
    ).toEqual([
      expect.objectContaining({
        userId: firstUser.id,
        email: firstUser.email,
        role: 'owner',
      }),
    ]);
    expect(
      await workspaces.listMembersForUser(secondUser.id, created.id),
    ).toBeUndefined();

    const addedMember = await workspaces.addMember(
      created.id,
      secondUser.id,
      secondUser.email,
    );
    expect(addedMember).toMatchObject({
      userId: secondUser.id,
      email: secondUser.email,
      role: 'member',
    });
    expect(
      await workspaces.addMember(created.id, secondUser.id, secondUser.email),
    ).toBeUndefined();
    expect(await workspaces.listForUser(secondUser.id)).toEqual([
      expect.objectContaining({ id: created.id, role: 'member' }),
    ]);
    expect(
      await workspaces.listMembersForUser(firstUser.id, created.id),
    ).toHaveLength(2);
    expect(await workspaces.removeMember(created.id, firstUser.id)).toBe(false);
    expect(await workspaces.removeMember(created.id, secondUser.id)).toBe(true);
    expect(await workspaces.removeMember(created.id, secondUser.id)).toBe(
      false,
    );
    expect(await workspaces.listForUser(secondUser.id)).toEqual([]);
    expect(
      await workspaces.listMembersForUser(firstUser.id, created.id),
    ).toHaveLength(1);
  });

  it('consumes OAuth state once and stores only encrypted connection tokens', async () => {
    const identities = new PostgresAuthRepository(connection.database);
    const workspaces = new PostgresWorkspaceRepository(connection.database);
    const connections = new PostgresInstagramConnectionRepository(
      connection.database,
    );
    const user = await identities.createUser('creator@example.com', 'hash');

    if (!user) {
      throw new Error('Expected the user to be created');
    }

    const workspace = await workspaces.createOwnedWorkspace(
      user.id,
      'Creator Studio',
    );
    const expiresAt = new Date('2026-09-23T10:10:00.000Z');
    await connections.createAuthorizationState({
      stateHash: 'a'.repeat(64),
      workspaceId: workspace.id,
      initiatedByUserId: user.id,
      expiresAt,
    });

    expect(
      await connections.consumeAuthorizationState(
        'a'.repeat(64),
        new Date('2026-09-23T10:00:00.000Z'),
      ),
    ).toMatchObject({ workspaceId: workspace.id });
    expect(
      await connections.consumeAuthorizationState(
        'a'.repeat(64),
        new Date('2026-09-23T10:00:00.000Z'),
      ),
    ).toBeUndefined();

    await connections.saveInstagramConnection({
      workspaceId: workspace.id,
      accountId: '17841400000000000',
      username: 'creator',
      accessToken: {
        ciphertext: 'encrypted-token',
        initializationVector: 'initialization-vector',
        authenticationTag: 'authentication-tag',
      },
      accessTokenExpiresAt: new Date('2026-11-22T10:00:00.000Z'),
    });

    expect(await connections.listForWorkspace(workspace.id)).toEqual([
      expect.objectContaining({
        platform: 'instagram',
        accountId: '17841400000000000',
        username: 'creator',
      }),
    ]);
    const stored = await maintenancePool.query<{
      encrypted_access_token: string;
    }>('SELECT encrypted_access_token FROM platform_connections');
    expect(stored.rows[0]?.encrypted_access_token).toBe('encrypted-token');
  });

  it('persists workspace-scoped content and its Instagram variant', async () => {
    const identities = new PostgresAuthRepository(connection.database);
    const workspaces = new PostgresWorkspaceRepository(connection.database);
    const content = new PostgresContentRepository(connection.database);
    const user = await identities.createUser('creator@example.com', 'hash');
    if (!user) throw new Error('Expected the user to be created');
    const workspace = await workspaces.createOwnedWorkspace(
      user.id,
      'Creator Studio',
    );

    const created = await content.create({
      workspaceId: workspace.id,
      createdByUserId: user.id,
      title: 'Launch post',
      body: 'Campaign notes',
      status: 'draft',
      instagram: {
        caption: 'Launching today.',
        mediaUrl: 'https://example.com/launch.jpg',
      },
    });
    expect(await content.listForWorkspace(workspace.id)).toEqual([created]);
    expect(
      await content.update(workspace.id, created.id, { status: 'ready' }),
    ).toMatchObject({ status: 'ready' });
    expect(await content.delete(workspace.id, created.id)).toBe(true);
    expect(await content.listForWorkspace(workspace.id)).toEqual([]);
  });
});
