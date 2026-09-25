import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type {
  InstagramAuthorization,
  InstagramProvider,
} from '../../../src/modules/connections/instagram/providers/instagram-provider.js';
import { MetaInstagramProvider } from '../../../src/modules/connections/instagram/providers/meta-instagram-provider.js';
import type {
  AuthorizationStateRecord,
  InstagramConnectionRepository,
  SaveInstagramConnectionInput,
} from '../../../src/modules/connections/instagram/repositories/instagram-connection-repository.js';
import { createInstagramConnectionRoutes } from '../../../src/modules/connections/instagram/routes/instagram-connection-routes.js';
import type { TokenEncryptor } from '../../../src/modules/connections/instagram/security/aes-token-encryptor.js';
import {
  InstagramConnectionService,
  type WorkspaceAccess,
} from '../../../src/modules/connections/instagram/services/instagram-connection-service.js';
import { ApplicationError } from '../../../src/shared/application-error.js';

const userId = 'a58cb521-0d85-43d1-9854-d72f928d5d3d';
const workspaceId = '7a53cb19-a18b-4fd4-bb5b-c9b881f90d41';
const connectionId = 'd69a9d2d-cef8-454a-b6e3-9d7a50b6f70d';

class MemoryInstagramConnectionRepository implements InstagramConnectionRepository {
  public state: AuthorizationStateRecord | undefined;
  public saved?: SaveInstagramConnectionInput;

  public createAuthorizationState(
    state: AuthorizationStateRecord,
  ): Promise<void> {
    this.state = state;
    return Promise.resolve();
  }

  public consumeAuthorizationState(
    stateHash: string,
    now: Date,
  ): Promise<AuthorizationStateRecord | undefined> {
    const state = this.state;
    this.state = undefined;
    return Promise.resolve(
      state?.stateHash === stateHash && state.expiresAt > now
        ? state
        : undefined,
    );
  }

  public saveInstagramConnection(input: SaveInstagramConnectionInput) {
    this.saved = input;
    return Promise.resolve({
      id: connectionId,
      platform: 'instagram' as const,
      accountId: input.accountId,
      username: input.username,
      connectedAt: '2026-09-23T10:00:00.000Z',
    });
  }

  public listForWorkspace(requestedWorkspaceId: string) {
    return Promise.resolve(
      this.saved?.workspaceId === requestedWorkspaceId
        ? [
            {
              id: connectionId,
              platform: 'instagram' as const,
              accountId: this.saved.accountId,
              username: this.saved.username,
              connectedAt: '2026-09-23T10:00:00.000Z',
            },
          ]
        : [],
    );
  }
}

function createService(role: 'owner' | 'member' = 'owner') {
  const repository = new MemoryInstagramConnectionRepository();
  const workspaceAccess: WorkspaceAccess = {
    getForUser: vi.fn().mockResolvedValue({
      id: workspaceId,
      name: 'Creator Studio',
      role,
      createdAt: '2026-09-23T10:00:00.000Z',
    }),
  };
  const instagram: InstagramProvider = {
    createAuthorizationUrl: (state) =>
      `https://www.instagram.com/oauth/authorize?state=${state}`,
    exchangeAuthorizationCode: vi.fn().mockResolvedValue({
      accountId: '17841400000000000',
      username: 'creator',
      accessToken: 'plain-secret-token',
      accessTokenExpiresAt: new Date('2026-11-22T10:00:00.000Z'),
    } satisfies InstagramAuthorization),
  };
  const tokenEncryptor: TokenEncryptor = {
    encrypt: vi.fn().mockReturnValue({
      ciphertext: 'encrypted-token',
      initializationVector: 'initialization-vector',
      authenticationTag: 'authentication-tag',
    }),
  };
  const service = new InstagramConnectionService(
    repository,
    workspaceAccess,
    instagram,
    tokenEncryptor,
    'http://localhost:3000',
    () => new Date('2026-09-23T10:00:00.000Z'),
  );
  return { service, repository };
}

function createRouteApp(
  service: InstagramConnectionService,
  authenticated = true,
) {
  const app = express();
  const requireAuthentication: RequestHandler = (_request, response, next) => {
    if (!authenticated) {
      response.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
      return;
    }

    response.locals.user = { id: userId, email: 'creator@example.com' };
    next();
  };
  const trustedOrigin: RequestHandler = (_request, _response, next) => {
    next();
  };
  app.use(
    createInstagramConnectionRoutes(
      service,
      requireAuthentication,
      trustedOrigin,
    ),
  );
  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    if (error instanceof ApplicationError) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }

    res.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
  };
  app.use(errorHandler);
  return app;
}

describe('Instagram workspace connection', () => {
  it('starts OAuth, consumes state once, encrypts the token, and lists the account', async () => {
    const { service, repository } = createService();
    const app = createRouteApp(service);

    const started = await request(app).post(
      `/workspaces/${workspaceId}/connections/instagram/authorization`,
    );
    expect(started.status).toBe(200);
    const authorizationUrl = new URL(
      (started.body as { authorizationUrl: string }).authorizationUrl,
    );
    const state = authorizationUrl.searchParams.get('state');
    expect(state).toBeTruthy();
    expect(repository.state?.stateHash).not.toBe(state);

    const callback = await request(app)
      .get('/connections/instagram/callback')
      .query({ code: 'authorization-code', state });
    expect(callback.status).toBe(303);
    expect(callback.headers.location).toBe(
      `http://localhost:3000/workspaces/${workspaceId}?instagram=connected`,
    );
    expect(repository.saved).toMatchObject({
      workspaceId,
      accountId: '17841400000000000',
      username: 'creator',
      accessToken: { ciphertext: 'encrypted-token' },
    });
    expect(JSON.stringify(repository.saved)).not.toContain(
      'plain-secret-token',
    );

    const listed = await request(app).get(
      `/workspaces/${workspaceId}/connections`,
    );
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({
      connections: [
        {
          id: connectionId,
          platform: 'instagram',
          accountId: '17841400000000000',
          username: 'creator',
          connectedAt: '2026-09-23T10:00:00.000Z',
        },
      ],
    });

    const replayed = await request(app)
      .get('/connections/instagram/callback')
      .query({ code: 'authorization-code', state });
    expect(replayed.status).toBe(400);
    expect(replayed.body).toMatchObject({
      error: { code: 'INVALID_OAUTH_STATE' },
    });
  });

  it('requires authentication and workspace ownership to begin OAuth', async () => {
    const ownerService = createService().service;
    expect(
      (
        await request(createRouteApp(ownerService, false)).post(
          `/workspaces/${workspaceId}/connections/instagram/authorization`,
        )
      ).status,
    ).toBe(401);

    const memberService = createService('member').service;
    const forbidden = await request(createRouteApp(memberService)).post(
      `/workspaces/${workspaceId}/connections/instagram/authorization`,
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({
      error: { code: 'WORKSPACE_OWNER_REQUIRED' },
    });
  });

  it('builds the requested scope and exchanges tokens through Meta endpoints', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'short-token', user_id: 123 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'long-token', expires_in: 3600 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '123', username: 'creator' }), {
          status: 200,
        }),
      );
    const provider = new MetaInstagramProvider({
      appId: 'app-id',
      appSecret: 'app-secret',
      redirectUri: 'http://localhost:3000/api/connections/instagram/callback',
      apiVersion: 'v26.0',
      fetch: fetchMock,
    });

    const authorizationUrl = new URL(provider.createAuthorizationUrl('state'));
    expect(authorizationUrl.searchParams.get('scope')).toBe(
      [
        'instagram_business_basic',
        'instagram_business_content_publish',
        'instagram_business_manage_comments',
        'instagram_business_manage_insights',
        'instagram_business_manage_messages',
      ].join(','),
    );

    const authorization =
      await provider.exchangeAuthorizationCode('authorization-code');
    expect(authorization).toMatchObject({
      accountId: '123',
      username: 'creator',
      accessToken: 'long-token',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestUrl(fetchMock.mock.calls[1]?.[0])).toContain(
      'graph.instagram.com/access_token',
    );
    expect(requestUrl(fetchMock.mock.calls[2]?.[0])).toContain(
      'graph.instagram.com/v26.0/me',
    );
  });
});

function requestUrl(input: string | URL | Request | undefined): string {
  if (input === undefined) {
    throw new Error('Expected a fetch request');
  }

  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.toString() : input.url;
}
