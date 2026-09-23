import {
  authSessionResponseSchema,
  authenticatedUserSchema,
  loginRequestSchema,
  registerRequestSchema,
} from '@creatorpilot/contracts';
import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

import { parseRequestBody } from '../../../shared/validation.js';
import type { IdentityService } from '../application/identity-service.js';
import { createRequireAuthentication } from './require-authentication.js';
import {
  clearSessionCookie,
  readSessionToken,
  type SessionCookieConfiguration,
  setSessionCookie,
} from './session-cookie.js';

export interface AuthRouterSecurity {
  cookie: SessionCookieConfiguration;
  trustedOrigin: RequestHandler;
}

export function createAuthRouter(
  identityService: IdentityService,
  security: AuthRouterSecurity,
): Router {
  const router = Router();
  const authenticationRateLimit = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 50,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const requireAuthentication = createRequireAuthentication(
    identityService,
    security.cookie,
  );

  router.post(
    '/register',
    security.trustedOrigin,
    authenticationRateLimit,
    async (request, response) => {
      const input = parseRequestBody(request, registerRequestSchema);
      const result = await identityService.register(input);

      setSessionCookie(
        response,
        security.cookie,
        result.session.token,
        result.session.expiresAt,
      );
      response
        .status(201)
        .json(authSessionResponseSchema.parse({ user: result.user }));
    },
  );

  router.post(
    '/login',
    security.trustedOrigin,
    authenticationRateLimit,
    async (request, response) => {
      const input = parseRequestBody(request, loginRequestSchema);
      const result = await identityService.login(input);

      setSessionCookie(
        response,
        security.cookie,
        result.session.token,
        result.session.expiresAt,
      );
      response.json(authSessionResponseSchema.parse({ user: result.user }));
    },
  );

  router.post('/logout', security.trustedOrigin, async (request, response) => {
    const token = readSessionToken(request, security.cookie);

    if (token) {
      await identityService.logout(token);
    }

    clearSessionCookie(response, security.cookie);
    response.status(204).send();
  });

  router.get('/session', requireAuthentication, (_request, response) => {
    const user = authenticatedUserSchema.parse(response.locals.user);
    response.json(authSessionResponseSchema.parse({ user }));
  });

  return router;
}
