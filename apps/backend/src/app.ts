import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { z, ZodError } from 'zod';

import { createInstagramAnalyticsRoutes } from './modules/analytics/instagram/routes/instagram-analytics-routes.js';
import type { InstagramAnalyticsService } from './modules/analytics/instagram/services/instagram-analytics-service.js';
import { createInstagramConnectionRoutes } from './modules/connections/instagram/routes/instagram-connection-routes.js';
import type { InstagramConnectionService } from './modules/connections/instagram/services/instagram-connection-service.js';
import { createContentRoutes } from './modules/content/routes/content-routes.js';
import type { ContentService } from './modules/content/services/content-service.js';
import { createAuthRoutes } from './modules/identity/authentication/auth-routes.js';
import type { AuthService } from './modules/identity/authentication/auth-service.js';
import { createRequireAuthentication } from './modules/identity/authentication/authentication-middleware.js';
import { createProfileRoutes } from './modules/identity/profiles/profile-routes.js';
import type { ProfileService } from './modules/identity/profiles/profile-service.js';
import type { SessionCookieOptions } from './modules/identity/sessions/session-cookie.js';
import { createWorkspaceRoutes } from './modules/workspaces/workspace-routes.js';
import type { WorkspaceService } from './modules/workspaces/workspace-service.js';
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
  authService: AuthService;
  workspaceService: WorkspaceService;
  applicationOrigin: string;
  requireTrustedOrigin: boolean;
  cookie: SessionCookieOptions;
  profileService?: ProfileService;
  connectionService?: InstagramConnectionService;
  contentService?: ContentService;
  analyticsService?: InstagramAnalyticsService;
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
      features.authService,
      features.cookie,
    );

    app.use(
      '/auth',
      createAuthRoutes(features.authService, {
        cookie: features.cookie,
        trustedOrigin,
      }),
    );
    app.use(
      '/workspaces',
      createWorkspaceRoutes(
        features.workspaceService,
        requireAuthentication,
        trustedOrigin,
      ),
    );

    if (features.profileService) {
      app.use(
        '/profile',
        createProfileRoutes(features.profileService, requireAuthentication),
      );
    }

    if (features.connectionService) {
      app.use(
        createInstagramConnectionRoutes(
          features.connectionService,
          requireAuthentication,
          trustedOrigin,
        ),
      );
    }

    if (features.contentService) {
      app.use(
        createContentRoutes(
          features.contentService,
          requireAuthentication,
          trustedOrigin,
        ),
      );
    }

    if (features.analyticsService) {
      app.use(
        createInstagramAnalyticsRoutes(
          features.analyticsService,
          requireAuthentication,
        ),
      );
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
