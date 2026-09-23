import {
  authenticatedUserSchema,
  createWorkspaceRequestSchema,
  workspaceListResponseSchema,
  workspaceSummarySchema,
} from '@creatorpilot/contracts';
import { Router, type RequestHandler } from 'express';

import { parseRequestBody } from '../../shared/validation.js';
import type { WorkspaceService } from './workspace-service.js';

export function createWorkspaceRoutes(
  workspaceService: WorkspaceService,
  requireAuthentication: RequestHandler,
  trustedOrigin: RequestHandler,
): Router {
  const router = Router();

  router.use(requireAuthentication);

  router.get('/', async (_request, response) => {
    const user = authenticatedUserSchema.parse(response.locals.user);
    const workspaces = await workspaceService.list(user.id);
    response.json(workspaceListResponseSchema.parse({ workspaces }));
  });

  router.post('/', trustedOrigin, async (request, response) => {
    const user = authenticatedUserSchema.parse(response.locals.user);
    const input = parseRequestBody(request, createWorkspaceRequestSchema);
    const workspace = await workspaceService.create(user.id, input);
    response.status(201).json(workspaceSummarySchema.parse(workspace));
  });

  return router;
}
