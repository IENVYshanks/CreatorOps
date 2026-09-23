import type { AuthenticatedUser, UserProfile } from '@creatorpilot/contracts';
import { profileResponseSchema } from '@creatorpilot/contracts';
import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { ApplicationError } from './shared/application-error.js';
import { AuthService } from './modules/identity/auth-service.js';
import type {
  AuthRepository,
  PasswordHasher,
  SessionTokenManager,
} from './modules/identity/auth-dependencies.js';
import type { StoredUser } from './modules/identity/auth-types.js';
import { createRequireAuthentication } from './modules/identity/authentication-middleware.js';
import { createProfileRoutes } from './modules/identity/profile-routes.js';
import type { ProfileRepository } from './modules/identity/profile-repository.js';
import { ProfileService } from './modules/identity/profile-service.js';

const userId = '4e075cf1-a65a-4f1e-b62f-c4a3cb4bf23d';
const profile: UserProfile = {
  id: userId,
  email: 'creator@example.com',
  createdAt: '2026-09-23T08:30:00.000Z',
};

describe('GET /profile', () => {
  it('returns only the authenticated user profile', async () => {
    const app = createProfileTestApp({ sessionIsValid: true });
    const response = await request(app)
      .get('/profile')
      .set('Cookie', 'creator_session=valid-token');

    expect(response.status).toBe(200);
    expect(profileResponseSchema.parse(response.body as unknown)).toEqual({
      profile,
    });
  });

  it('rejects a request without a session cookie', async () => {
    const response = await request(
      createProfileTestApp({ sessionIsValid: true }),
    ).get('/profile');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: { code: 'UNAUTHENTICATED' },
    });
  });

  it('rejects an expired or unknown session', async () => {
    const app = createProfileTestApp({ sessionIsValid: false });
    const response = await request(app)
      .get('/profile')
      .set('Cookie', 'creator_session=expired-token');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: { code: 'UNAUTHENTICATED' },
    });
  });
});

function createProfileTestApp(options: { sessionIsValid: boolean }) {
  const authService = new AuthService(
    new SessionOnlyAuthRepository(options.sessionIsValid),
    new UnusedPasswordHasher(),
    new TestSessionTokens(),
    1,
  );
  const profileService = new ProfileService(new TestProfileRepository());
  const requireAuthentication = createRequireAuthentication(authService, {
    name: 'creator_session',
    secure: false,
  });
  const app = express();

  app.use(
    '/profile',
    createProfileRoutes(profileService, requireAuthentication),
  );
  app.use(((error: unknown, _request, response, _next) => {
    if (error instanceof ApplicationError) {
      response.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }

    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }) satisfies ErrorRequestHandler);

  return app;
}

class SessionOnlyAuthRepository implements AuthRepository {
  public constructor(private readonly sessionIsValid: boolean) {}

  public createUser(): Promise<StoredUser | undefined> {
    return Promise.resolve(undefined);
  }

  public findUserByEmail(): Promise<StoredUser | undefined> {
    return Promise.resolve(undefined);
  }

  public createSession(): Promise<void> {
    return Promise.resolve();
  }

  public findUserBySession(): Promise<AuthenticatedUser | undefined> {
    return Promise.resolve(
      this.sessionIsValid
        ? { id: profile.id, email: profile.email }
        : undefined,
    );
  }

  public deleteSession(): Promise<void> {
    return Promise.resolve();
  }
}

class UnusedPasswordHasher implements PasswordHasher {
  public hash(password: string): Promise<string> {
    return Promise.resolve(password);
  }

  public verify(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

class TestSessionTokens implements SessionTokenManager {
  public create(): string {
    return 'unused-token';
  }

  public hash(token: string): string {
    return `hashed:${token}`;
  }
}

class TestProfileRepository implements ProfileRepository {
  public findByUserId(
    requestedUserId: string,
  ): Promise<UserProfile | undefined> {
    return Promise.resolve(
      requestedUserId === profile.id ? profile : undefined,
    );
  }
}
