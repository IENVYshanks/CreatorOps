import type { RequestHandler } from 'express';

import type { AuthService } from './auth-service.js';
import {
  readSessionToken,
  type SessionCookieOptions,
} from './session-cookie.js';

export function createRequireAuthentication(
  authService: AuthService,
  cookie: SessionCookieOptions,
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

      response.locals.user = await authService.authenticate(token);
      response.locals.sessionToken = token;
      next();
    } catch (error: unknown) {
      next(error);
    }
  };
}
