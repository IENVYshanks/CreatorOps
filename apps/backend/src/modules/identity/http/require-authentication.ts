import type { RequestHandler } from 'express';

import type { IdentityService } from '../application/identity-service.js';
import {
  readSessionToken,
  type SessionCookieConfiguration,
} from './session-cookie.js';

export function createRequireAuthentication(
  identityService: IdentityService,
  cookie: SessionCookieConfiguration,
): RequestHandler {
  return async (request, response, next) => {
    try {
      const token = readSessionToken(request, cookie);

      if (!token) {
        response.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        });
        return;
      }

      response.locals.user = await identityService.authenticate(token);
      response.locals.sessionToken = token;
      next();
    } catch (error: unknown) {
      next(error);
    }
  };
}
