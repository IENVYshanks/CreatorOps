import {
  authenticatedUserSchema,
  contentDraftListResponseSchema,
  contentDraftParametersSchema,
  contentDraftSchema,
  createContentDraftRequestSchema,
  updateContentDraftRequestSchema,
  workspaceIdParametersSchema,
} from '@creatorpilot/contracts';
import { Router, type RequestHandler } from 'express';

import { parseRequestBody } from '../../../shared/validation.js';
import type { ContentService } from '../services/content-service.js';

export function createContentRoutes(
  contentService: ContentService,
  requireAuthentication: RequestHandler,
  trustedOrigin: RequestHandler,
): Router {
  const router = Router();
  router.use(requireAuthentication);

  router.get('/workspaces/:workspaceId/content', async (request, response) => {
    const user = authenticatedUserSchema.parse(response.locals.user);
    const { workspaceId } = workspaceIdParametersSchema.parse(request.params);
    const content = await contentService.list(user.id, workspaceId);
    response.json(contentDraftListResponseSchema.parse({ content }));
  });

  router.get(
    '/workspaces/:workspaceId/content/:contentId',
    async (request, response) => {
      const user = authenticatedUserSchema.parse(response.locals.user);
      const { workspaceId, contentId } = contentDraftParametersSchema.parse(
        request.params,
      );
      const content = await contentService.get(user.id, workspaceId, contentId);
      response.json(contentDraftSchema.parse(content));
    },
  );

  router.post(
    '/workspaces/:workspaceId/content',
    trustedOrigin,
    async (request, response) => {
      const user = authenticatedUserSchema.parse(response.locals.user);
      const { workspaceId } = workspaceIdParametersSchema.parse(request.params);
      const input = parseRequestBody(request, createContentDraftRequestSchema);
      const content = await contentService.create(user.id, workspaceId, input);
      response.status(201).json(contentDraftSchema.parse(content));
    },
  );

  router.patch(
    '/workspaces/:workspaceId/content/:contentId',
    trustedOrigin,
    async (request, response) => {
      const user = authenticatedUserSchema.parse(response.locals.user);
      const { workspaceId, contentId } = contentDraftParametersSchema.parse(
        request.params,
      );
      const input = parseRequestBody(request, updateContentDraftRequestSchema);
      const content = await contentService.update(
        user.id,
        workspaceId,
        contentId,
        input,
      );
      response.json(contentDraftSchema.parse(content));
    },
  );

  router.delete(
    '/workspaces/:workspaceId/content/:contentId',
    trustedOrigin,
    async (request, response) => {
      const user = authenticatedUserSchema.parse(response.locals.user);
      const { workspaceId, contentId } = contentDraftParametersSchema.parse(
        request.params,
      );
      await contentService.delete(user.id, workspaceId, contentId);
      response.status(204).send();
    },
  );

  return router;
}
