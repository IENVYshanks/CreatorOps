import {
  authenticatedUserSchema,
  instagramAnalyticsQuerySchema,
  instagramAnalyticsResponseSchema,
  workspaceIdParametersSchema,
} from '@creatorpilot/contracts';
import { Router, type RequestHandler } from 'express';

import type { InstagramAnalyticsService } from '../services/instagram-analytics-service.js';

export function createInstagramAnalyticsRoutes(
  analyticsService: InstagramAnalyticsService,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.get(
    '/workspaces/:workspaceId/analytics/instagram',
    requireAuthentication,
    async (request, response) => {
      const user = authenticatedUserSchema.parse(response.locals.user);
      const { workspaceId } = workspaceIdParametersSchema.parse(request.params);
      const { rangeDays } = instagramAnalyticsQuerySchema.parse(request.query);
      const analytics = await analyticsService.getForWorkspace(
        user.id,
        workspaceId,
        rangeDays,
      );

      response.json(instagramAnalyticsResponseSchema.parse(analytics));
    },
  );

  return router;
}
