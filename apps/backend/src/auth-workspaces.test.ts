import { randomUUID } from 'node:crypto';

import type {
  AuthenticatedUser,
  WorkspaceSummary,
} from '@creatorpilot/contracts';
import {
  apiErrorResponseSchema,
  authSessionResponseSchema,
  workspaceListResponseSchema,
  workspaceSummarySchema,
} from '@creatorpilot/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import type {
  AuthRepository,
  PasswordHasher,
  SessionTokenManager,
} from './modules/identity/auth-dependencies.js';
import { AuthService } from './modules/identity/auth-service.js';
import type { StoredUser } from './modules/identity/auth-types.js';
import type { WorkspaceRepository } from './modules/workspaces/workspace-repository.js';
import { WorkspaceService } from './modules/workspaces/workspace-service.js';

describe('authentication and workspace API', () => {
  it('registers a user and creates a revocable cookie session', async () => {
    const app = createTestApp();
    const agent = request.agent(app);

    const registration = await agent.post('/auth/register').send({
      email: ' Creator@Example.com ',
      password: 'a secure password',
    });

    expect(registration.status).toBe(201);
    const registrationBody = authSessionResponseSchema.parse(
      registration.body as unknown,
    );
    expect(registrationBody.user.email).toBe('creator@example.com');
    expect(registration.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(registration.headers['set-cookie']?.[0]).toContain(
      'SameSite=Strict',
    );

    const session = await agent.get('/auth/session');
    expect(session.status).toBe(200);

    const logout = await agent.post('/auth/logout');
    expect(logout.status).toBe(204);
    expect((await agent.get('/auth/session')).status).toBe(401);
  });

  it('returns stable validation, conflict, and credential errors', async () => {
    const app = createTestApp();

    const invalid = await request(app).post('/auth/register').send({
      email: 'not-an-email',
      password: 'short',
    });
    expect(invalid.status).toBe(400);
    expect(
      apiErrorResponseSchema.parse(invalid.body as unknown).error.code,
    ).toBe('VALIDATION_ERROR');

    const credentials = {
      email: 'creator@example.com',
      password: 'a secure password',
    };
    await request(app).post('/auth/register').send(credentials);

    const duplicate = await request(app)
      .post('/auth/register')
      .send(credentials);
    expect(duplicate.status).toBe(409);
    expect(
      apiErrorResponseSchema.parse(duplicate.body as unknown).error.code,
    ).toBe('EMAIL_ALREADY_REGISTERED');

    const login = await request(app)
      .post('/auth/login')
      .send({
        ...credentials,
        password: 'the wrong password',
      });
    expect(login.status).toBe(401);
    expect(apiErrorResponseSchema.parse(login.body as unknown).error.code).toBe(
      'INVALID_CREDENTIALS',
    );
  });

  it('requires authentication and isolates workspace lists by user', async () => {
    const app = createTestApp();
    const firstUser = request.agent(app);
    const secondUser = request.agent(app);

    expect((await request(app).get('/workspaces')).status).toBe(401);

    await firstUser.post('/auth/register').send({
      email: 'first@example.com',
      password: 'first secure password',
    });
    await secondUser.post('/auth/register').send({
      email: 'second@example.com',
      password: 'second secure password',
    });

    const created = await firstUser
      .post('/workspaces')
      .send({ name: 'First Studio' });
    expect(created.status).toBe(201);
    expect(workspaceSummarySchema.parse(created.body as unknown).role).toBe(
      'owner',
    );

    const firstList = await firstUser.get('/workspaces');
    const secondList = await secondUser.get('/workspaces');
    expect(
      workspaceListResponseSchema.parse(firstList.body as unknown).workspaces,
    ).toHaveLength(1);
    expect(
      workspaceListResponseSchema.parse(secondList.body as unknown).workspaces,
    ).toEqual([]);
  });

  it('rejects state changes from an untrusted production origin', async () => {
    const app = createTestApp(true);

    const response = await request(app)
      .post('/auth/register')
      .set('Origin', 'https://attacker.example')
      .send({
        email: 'creator@example.com',
        password: 'a secure password',
      });

    expect(response.status).toBe(403);
    expect(
      apiErrorResponseSchema.parse(response.body as unknown).error.code,
    ).toBe('UNTRUSTED_ORIGIN');
  });
});

function createTestApp(requireTrustedOrigin = false) {
  const authService = new AuthService(
    new InMemoryAuthRepository(),
    new TestPasswordHasher(),
    new TestSessionTokens(),
    24,
  );

  return createApp({
    authService,
    workspaceService: new WorkspaceService(new InMemoryWorkspaceRepository()),
    applicationOrigin: 'https://app.example.com',
    requireTrustedOrigin,
    cookie: { name: 'creator_session', secure: false },
  });
}

class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, StoredUser>();
  private readonly sessions = new Map<
    string,
    { userId: string; expiresAt: Date }
  >();

  public createUser(
    email: string,
    passwordHash: string,
  ): Promise<StoredUser | undefined> {
    if (this.users.has(email)) {
      return Promise.resolve(undefined);
    }

    const user = { id: randomUUID(), email, passwordHash };
    this.users.set(email, user);
    return Promise.resolve(user);
  }

  public findUserByEmail(email: string): Promise<StoredUser | undefined> {
    return Promise.resolve(this.users.get(email));
  }

  public createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    this.sessions.set(tokenHash, { userId, expiresAt });
    return Promise.resolve();
  }

  public findUserBySession(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedUser | undefined> {
    const session = this.sessions.get(tokenHash);
    const user = [...this.users.values()].find(
      (candidate) => candidate.id === session?.userId,
    );

    if (!session || session.expiresAt <= now || !user) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve({ id: user.id, email: user.email });
  }

  public deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
    return Promise.resolve();
  }
}

class TestPasswordHasher implements PasswordHasher {
  public hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  public verify(passwordHash: string, password: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hashed:${password}`);
  }
}

class TestSessionTokens implements SessionTokenManager {
  private counter = 0;

  public create(): string {
    this.counter += 1;
    return `session-${this.counter.toString()}`;
  }

  public hash(token: string): string {
    return `hashed:${token}`;
  }
}

class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly workspaces: (WorkspaceSummary & { userId: string })[] = [];

  public createOwnedWorkspace(
    userId: string,
    name: string,
  ): Promise<WorkspaceSummary> {
    const workspace = {
      id: randomUUID(),
      name,
      role: 'owner' as const,
      userId,
    };
    this.workspaces.push(workspace);
    return Promise.resolve(workspace);
  }

  public listForUser(userId: string): Promise<WorkspaceSummary[]> {
    return Promise.resolve(
      this.workspaces
        .filter((workspace) => workspace.userId === userId)
        .map(({ id, name, role }) => ({ id, name, role })),
    );
  }
}
