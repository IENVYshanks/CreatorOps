import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { z, ZodError } from 'zod';

import type { IdentityService } from './modules/identity/application/identity-service.js';
import { createAuthRouter } from './modules/identity/http/auth-router.js';
import { createRequireAuthentication } from './modules/identity/http/require-authentication.js';
import type { SessionCookieConfiguration } from './modules/identity/http/session-cookie.js';
import type { WorkspaceService } from './modules/workspaces/application/workspace-service.js';
import { createWorkspaceRouter } from './modules/workspaces/http/workspace-router.js';
import { ApplicationError } from './shared/application-error.js';
import { createTrustedOriginMiddleware } from './shared/trusted-origin.js';

const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

const healthHandler: RequestHandler = (_request, response) => {
  response.status(200).json(healthResponseSchema.parse({ status: 'ok' }));
};

const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
};

const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  request.log.error({ error }, 'Unhandled request error');

  if (error instanceof ApplicationError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues,
      },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
};

export interface AppFeatures {
  identityService: IdentityService;
  workspaceService: WorkspaceService;
  applicationOrigin: string;
  requireTrustedOrigin: boolean;
  cookie: SessionCookieConfiguration;
}

export function createApp(features?: AppFeatures): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp());
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', healthHandler);

  if (features) {
    const trustedOrigin = createTrustedOriginMiddleware(
      features.applicationOrigin,
      features.requireTrustedOrigin,
    );
    const requireAuthentication = createRequireAuthentication(
      features.identityService,
      features.cookie,
    );

    app.use(
      '/auth',
      createAuthRouter(features.identityService, {
        cookie: features.cookie,
        trustedOrigin,
      }),
    );
    app.use(
      '/workspaces',
      createWorkspaceRouter(
        features.workspaceService,
        requireAuthentication,
        trustedOrigin,
      ),
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
