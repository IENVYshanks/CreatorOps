import { readFile } from 'node:fs/promises';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDatabaseConnection, type DatabaseConnection } from './client.js';
import { DrizzleIdentityRepository } from '../modules/identity/infrastructure/drizzle-identity-repository.js';
import { DrizzleWorkspaceRepository } from '../modules/workspaces/infrastructure/drizzle-workspace-repository.js';

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

    const migration = await readFile(
      new URL('../../drizzle/0000_dizzy_khan.sql', import.meta.url),
      'utf8',
    );
    await maintenancePool.query(migration);
    connection = createDatabaseConnection(container.getConnectionUri());
  }, 120_000);

  beforeEach(async () => {
    await maintenancePool.query(
      'TRUNCATE workspace_memberships, workspaces, sessions, users CASCADE',
    );
  });

  afterAll(async () => {
    await connection.close();
    await maintenancePool.end();
    await stopContainer();
  });

  it('persists users and resolves only live sessions', async () => {
    const repository = new DrizzleIdentityRepository(connection.database);
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
    const identities = new DrizzleIdentityRepository(connection.database);
    const workspaces = new DrizzleWorkspaceRepository(connection.database);
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
  });
});
