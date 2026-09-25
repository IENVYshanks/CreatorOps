import {
  authenticatedUserSchema,
  instagramAuthorizationResponseSchema,
  instagramCallbackQuerySchema,
  platformConnectionListResponseSchema,
  workspaceIdParametersSchema,
} from '@creatorpilot/contracts';
import { Router, type RequestHandler } from 'express';

import type { InstagramConnectionService } from '../services/instagram-connection-service.js';

export function createInstagramConnectionRoutes(
  connectionService: InstagramConnectionService,
  requireAuthentication: RequestHandler,
  trustedOrigin: RequestHandler,
): Router {
  const router = Router();

  router.get(
    '/workspaces/:workspaceId/connections',
    requireAuthentication,
    async (request, response) => {
      const user = authenticatedUserSchema.parse(response.locals.user);
      const { workspaceId } = workspaceIdParametersSchema.parse(request.params);
      const connections = await connectionService.listForWorkspace(
        user.id,
        workspaceId,
      );

      response.json(
        platformConnectionListResponseSchema.parse({ connections }),
      );
    },
  );

  router.post(
    '/workspaces/:workspaceId/connections/instagram/authorization',
    requireAuthentication,
    trustedOrigin,
    async (request, response) => {
      const user = authenticatedUserSchema.parse(response.locals.user);
      const { workspaceId } = workspaceIdParametersSchema.parse(request.params);
      const authorization = await connectionService.beginInstagramAuthorization(
        user.id,
        workspaceId,
      );

      response.json(instagramAuthorizationResponseSchema.parse(authorization));
    },
  );

  router.get('/connections/instagram/callback', async (request, response) => {
    const { code, state } = instagramCallbackQuerySchema.parse(request.query);
    const returnUrl = await connectionService.completeInstagramAuthorization(
      code,
      state,
    );
    response.redirect(303, returnUrl);
  });

  return router;
}
