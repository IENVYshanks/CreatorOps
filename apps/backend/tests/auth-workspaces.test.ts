import { randomUUID } from 'node:crypto';

import type {
  AuthenticatedUser,
  WorkspaceDetails,
  WorkspaceMember,
  WorkspaceSummary,
} from '@creatorpilot/contracts';
import {
  apiErrorResponseSchema,
  authSessionResponseSchema,
  workspaceListResponseSchema,
  workspaceDetailsSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberSchema,
  workspaceSummarySchema,
} from '@creatorpilot/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import type {
  AuthRepository,
  PasswordHasher,
  SessionTokenManager,
} from '../src/modules/identity/authentication/auth-dependencies.js';
import { AuthService } from '../src/modules/identity/authentication/auth-service.js';
import type { StoredUser } from '../src/modules/identity/authentication/auth-types.js';
import type { WorkspaceRepository } from '../src/modules/workspaces/workspace-repository.js';
import { WorkspaceService } from '../src/modules/workspaces/workspace-service.js';

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
    const createdWorkspace = workspaceSummarySchema.parse(
      created.body as unknown,
    );
    expect(createdWorkspace.role).toBe('owner');

    const firstList = await firstUser.get('/workspaces');
    const secondList = await secondUser.get('/workspaces');
    expect(
      workspaceListResponseSchema.parse(firstList.body as unknown).workspaces,
    ).toHaveLength(1);
    expect(
      workspaceListResponseSchema.parse(secondList.body as unknown).workspaces,
    ).toEqual([]);

    expect(
      (await request(app).get(`/workspaces/${createdWorkspace.id}`)).status,
    ).toBe(401);

    const details = await firstUser.get(`/workspaces/${createdWorkspace.id}`);
    expect(details.status).toBe(200);
    expect(workspaceDetailsSchema.parse(details.body as unknown)).toMatchObject(
      {
        ...createdWorkspace,
      },
    );

    expect(
      (await request(app).get(`/workspaces/${createdWorkspace.id}/members`))
        .status,
    ).toBe(401);

    const memberList = await firstUser.get(
      `/workspaces/${createdWorkspace.id}/members`,
    );
    expect(memberList.status).toBe(200);
    const members = workspaceMemberListResponseSchema.parse(
      memberList.body as unknown,
    ).members;
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ role: 'owner' });

    const membersHiddenFromNonMember = await secondUser.get(
      `/workspaces/${createdWorkspace.id}/members`,
    );
    expect(membersHiddenFromNonMember.status).toBe(404);
    expect(
      apiErrorResponseSchema.parse(membersHiddenFromNonMember.body as unknown)
        .error.code,
    ).toBe('WORKSPACE_NOT_FOUND');

    const invalidMemberWorkspaceId = await firstUser.get(
      '/workspaces/not-a-uuid/members',
    );
    expect(invalidMemberWorkspaceId.status).toBe(400);

    const hiddenFromNonMember = await secondUser.get(
      `/workspaces/${createdWorkspace.id}`,
    );
    expect(hiddenFromNonMember.status).toBe(404);
    expect(
      apiErrorResponseSchema.parse(hiddenFromNonMember.body as unknown).error
        .code,
    ).toBe('WORKSPACE_NOT_FOUND');

    const unknownWorkspace = await firstUser.get(`/workspaces/${randomUUID()}`);
    expect(unknownWorkspace.status).toBe(404);

    const invalidWorkspaceId = await firstUser.get('/workspaces/not-a-uuid');
    expect(invalidWorkspaceId.status).toBe(400);
    expect(
      apiErrorResponseSchema.parse(invalidWorkspaceId.body as unknown).error
        .code,
    ).toBe('VALIDATION_ERROR');
  });

  it('allows only an owner to add an existing user as a workspace member', async () => {
    const app = createTestApp();
    const owner = request.agent(app);
    const member = request.agent(app);
    const outsider = request.agent(app);

    await owner.post('/auth/register').send({
      email: 'owner@example.com',
      password: 'owner secure password',
    });
    await member.post('/auth/register').send({
      email: 'member@example.com',
      password: 'member secure password',
    });
    await outsider.post('/auth/register').send({
      email: 'outsider@example.com',
      password: 'outsider secure password',
    });

    const created = workspaceSummarySchema.parse(
      (await owner.post('/workspaces').send({ name: 'Collaborative Studio' }))
        .body as unknown,
    );
    const memberPath = `/workspaces/${created.id}/members`;

    expect(
      (
        await request(app)
          .post(memberPath)
          .send({ email: 'member@example.com' })
      ).status,
    ).toBe(401);

    const invalid = await owner.post(memberPath).send({ email: 'invalid' });
    expect(invalid.status).toBe(400);
    expect(
      apiErrorResponseSchema.parse(invalid.body as unknown).error.code,
    ).toBe('VALIDATION_ERROR');

    const unknownUser = await owner
      .post(memberPath)
      .send({ email: 'missing@example.com' });
    expect(unknownUser.status).toBe(404);
    expect(
      apiErrorResponseSchema.parse(unknownUser.body as unknown).error.code,
    ).toBe('USER_NOT_FOUND');

    const added = await owner
      .post(memberPath)
      .send({ email: ' Member@Example.COM ' });
    expect(added.status).toBe(201);
    expect(workspaceMemberSchema.parse(added.body as unknown)).toMatchObject({
      email: 'member@example.com',
      role: 'member',
    });

    const duplicate = await owner
      .post(memberPath)
      .send({ email: 'member@example.com' });
    expect(duplicate.status).toBe(409);
    expect(
      apiErrorResponseSchema.parse(duplicate.body as unknown).error.code,
    ).toBe('WORKSPACE_MEMBER_EXISTS');

    const memberForbidden = await member
      .post(memberPath)
      .send({ email: 'outsider@example.com' });
    expect(memberForbidden.status).toBe(403);
    expect(
      apiErrorResponseSchema.parse(memberForbidden.body as unknown).error.code,
    ).toBe('WORKSPACE_OWNER_REQUIRED');

    const workspaceHidden = await outsider
      .post(memberPath)
      .send({ email: 'member@example.com' });
    expect(workspaceHidden.status).toBe(404);
    expect(
      apiErrorResponseSchema.parse(workspaceHidden.body as unknown).error.code,
    ).toBe('WORKSPACE_NOT_FOUND');

    const listed = await owner.get(memberPath);
    expect(
      workspaceMemberListResponseSchema.parse(listed.body as unknown).members,
    ).toHaveLength(2);
  });

  it('allows only an owner to remove a non-owner workspace member', async () => {
    const app = createTestApp();
    const owner = request.agent(app);
    const member = request.agent(app);
    const outsider = request.agent(app);

    const ownerUser = authSessionResponseSchema.parse(
      (
        await owner.post('/auth/register').send({
          email: 'owner@example.com',
          password: 'owner secure password',
        })
      ).body as unknown,
    ).user;
    const memberUser = authSessionResponseSchema.parse(
      (
        await member.post('/auth/register').send({
          email: 'member@example.com',
          password: 'member secure password',
        })
      ).body as unknown,
    ).user;
    const outsiderUser = authSessionResponseSchema.parse(
      (
        await outsider.post('/auth/register').send({
          email: 'outsider@example.com',
          password: 'outsider secure password',
        })
      ).body as unknown,
    ).user;

    const workspace = workspaceSummarySchema.parse(
      (await owner.post('/workspaces').send({ name: 'Removal Studio' }))
        .body as unknown,
    );
    const memberPath = `/workspaces/${workspace.id}/members`;
    await owner.post(memberPath).send({ email: memberUser.email });

    expect(
      (await request(app).delete(`${memberPath}/${memberUser.id}`)).status,
    ).toBe(401);

    const invalid = await owner.delete(`${memberPath}/not-a-uuid`);
    expect(invalid.status).toBe(400);
    expect(
      apiErrorResponseSchema.parse(invalid.body as unknown).error.code,
    ).toBe('VALIDATION_ERROR');

    const memberForbidden = await member.delete(
      `${memberPath}/${outsiderUser.id}`,
    );
    expect(memberForbidden.status).toBe(403);
    expect(
      apiErrorResponseSchema.parse(memberForbidden.body as unknown).error.code,
    ).toBe('WORKSPACE_OWNER_REQUIRED');

    const workspaceHidden = await outsider.delete(
      `${memberPath}/${memberUser.id}`,
    );
    expect(workspaceHidden.status).toBe(404);
    expect(
      apiErrorResponseSchema.parse(workspaceHidden.body as unknown).error.code,
    ).toBe('WORKSPACE_NOT_FOUND');

    const ownerProtected = await owner.delete(`${memberPath}/${ownerUser.id}`);
    expect(ownerProtected.status).toBe(409);
    expect(
      apiErrorResponseSchema.parse(ownerProtected.body as unknown).error.code,
    ).toBe('WORKSPACE_OWNER_CANNOT_BE_REMOVED');

    const unknownMember = await owner.delete(`${memberPath}/${randomUUID()}`);
    expect(unknownMember.status).toBe(404);
    expect(
      apiErrorResponseSchema.parse(unknownMember.body as unknown).error.code,
    ).toBe('WORKSPACE_MEMBER_NOT_FOUND');

    const removed = await owner.delete(`${memberPath}/${memberUser.id}`);
    expect(removed.status).toBe(204);
    expect(removed.text).toBe('');

    const repeated = await owner.delete(`${memberPath}/${memberUser.id}`);
    expect(repeated.status).toBe(404);
    expect(
      apiErrorResponseSchema.parse(repeated.body as unknown).error.code,
    ).toBe('WORKSPACE_MEMBER_NOT_FOUND');

    const listed = await owner.get(memberPath);
    expect(
      workspaceMemberListResponseSchema.parse(listed.body as unknown).members,
    ).toHaveLength(1);
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

    const owner = request.agent(app);
    await owner
      .post('/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({
        email: 'owner@example.com',
        password: 'owner secure password',
      });
    await request(app)
      .post('/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({
        email: 'member@example.com',
        password: 'member secure password',
      });
    const workspace = workspaceSummarySchema.parse(
      (
        await owner
          .post('/workspaces')
          .set('Origin', 'https://app.example.com')
          .send({ name: 'Protected Studio' })
      ).body as unknown,
    );

    const addMember = await owner
      .post(`/workspaces/${workspace.id}/members`)
      .set('Origin', 'https://attacker.example')
      .send({ email: 'member@example.com' });
    expect(addMember.status).toBe(403);
    expect(
      apiErrorResponseSchema.parse(addMember.body as unknown).error.code,
    ).toBe('UNTRUSTED_ORIGIN');

    const removeMember = await owner
      .delete(`/workspaces/${workspace.id}/members/${randomUUID()}`)
      .set('Origin', 'https://attacker.example');
    expect(removeMember.status).toBe(403);
    expect(
      apiErrorResponseSchema.parse(removeMember.body as unknown).error.code,
    ).toBe('UNTRUSTED_ORIGIN');
  });
});

function createTestApp(requireTrustedOrigin = false) {
  const authRepository = new InMemoryAuthRepository();
  const authService = new AuthService(
    authRepository,
    new TestPasswordHasher(),
    new TestSessionTokens(),
    24,
  );

  return createApp({
    authService,
    workspaceService: new WorkspaceService(
      new InMemoryWorkspaceRepository(),
      authRepository,
    ),
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
  private readonly workspaces: (WorkspaceDetails & { userId: string })[] = [];
  private readonly members: (WorkspaceMember & { workspaceId: string })[] = [];

  public createOwnedWorkspace(
    userId: string,
    name: string,
  ): Promise<WorkspaceSummary> {
    const workspace = {
      id: randomUUID(),
      name,
      role: 'owner' as const,
      userId,
      createdAt: new Date().toISOString(),
    };
    this.workspaces.push(workspace);
    return Promise.resolve(workspace);
  }

  public listForUser(userId: string): Promise<WorkspaceSummary[]> {
    const owned = this.workspaces
      .filter((workspace) => workspace.userId === userId)
      .map(({ id, name, role }) => ({ id, name, role }));
    const joined = this.members
      .filter((member) => member.userId === userId)
      .flatMap((member) => {
        const workspace = this.workspaces.find(
          (candidate) => candidate.id === member.workspaceId,
        );

        return workspace
          ? [{ id: workspace.id, name: workspace.name, role: member.role }]
          : [];
      });

    return Promise.resolve([...owned, ...joined]);
  }

  public findForUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceDetails | undefined> {
    const workspace = this.workspaces.find(
      (candidate) => candidate.id === workspaceId,
    );

    if (!workspace) {
      return Promise.resolve(undefined);
    }

    const membership = this.members.find(
      (candidate) =>
        candidate.workspaceId === workspaceId && candidate.userId === userId,
    );
    const role =
      workspace.userId === userId ? workspace.role : membership?.role;

    if (!role) {
      return Promise.resolve(undefined);
    }

    const { id, name, createdAt } = workspace;
    return Promise.resolve({ id, name, role, createdAt });
  }

  public listMembersForUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMember[] | undefined> {
    const workspace = this.workspaces.find(
      (candidate) => candidate.id === workspaceId,
    );

    const canView =
      workspace?.userId === userId ||
      this.members.some(
        (member) =>
          member.workspaceId === workspaceId && member.userId === userId,
      );

    if (!workspace || !canView) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve([
      {
        userId: workspace.userId,
        email: `member-${workspace.userId}@example.com`,
        role: workspace.role,
        joinedAt: workspace.createdAt,
      },
      ...this.members.filter((member) => member.workspaceId === workspaceId),
    ]);
  }

  public addMember(
    workspaceId: string,
    userId: string,
    email: string,
  ): Promise<WorkspaceMember | undefined> {
    const workspace = this.workspaces.find(
      (candidate) => candidate.id === workspaceId,
    );
    const alreadyExists =
      workspace?.userId === userId ||
      this.members.some(
        (member) =>
          member.workspaceId === workspaceId && member.userId === userId,
      );

    if (!workspace || alreadyExists) {
      return Promise.resolve(undefined);
    }

    const member = {
      workspaceId,
      userId,
      email,
      role: 'member' as const,
      joinedAt: new Date().toISOString(),
    };
    this.members.push(member);
    return Promise.resolve(member);
  }

  public removeMember(workspaceId: string, userId: string): Promise<boolean> {
    const membershipIndex = this.members.findIndex(
      (member) =>
        member.workspaceId === workspaceId && member.userId === userId,
    );

    if (membershipIndex === -1) {
      return Promise.resolve(false);
    }

    this.members.splice(membershipIndex, 1);
    return Promise.resolve(true);
  }
}
