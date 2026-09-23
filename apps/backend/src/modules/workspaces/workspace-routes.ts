import {
  addWorkspaceMemberRequestSchema,
  authenticatedUserSchema,
  createWorkspaceRequestSchema,
  workspaceDetailsSchema,
  workspaceIdParametersSchema,
  workspaceListResponseSchema,
  workspaceMemberSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberParametersSchema,
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

  router.get('/:workspaceId', async (request, response) => {
    const user = authenticatedUserSchema.parse(response.locals.user);
    const { workspaceId } = workspaceIdParametersSchema.parse(request.params);
    const workspace = await workspaceService.getForUser(user.id, workspaceId);

    response.json(workspaceDetailsSchema.parse(workspace));
  });

  router.get('/:workspaceId/members', async (request, response) => {
    const user = authenticatedUserSchema.parse(response.locals.user);
    const { workspaceId } = workspaceIdParametersSchema.parse(request.params);
    const members = await workspaceService.listMembers(user.id, workspaceId);

    response.json(workspaceMemberListResponseSchema.parse({ members }));
  });

  router.post(
    '/:workspaceId/members',
    trustedOrigin,
    async (request, response) => {
      const user = authenticatedUserSchema.parse(response.locals.user);
      const { workspaceId } = workspaceIdParametersSchema.parse(request.params);
      const input = parseRequestBody(request, addWorkspaceMemberRequestSchema);
      const member = await workspaceService.addMember(
        user.id,
        workspaceId,
        input,
      );

      response.status(201).json(workspaceMemberSchema.parse(member));
    },
  );

  router.delete(
    '/:workspaceId/members/:userId',
    trustedOrigin,
    async (request, response) => {
      const user = authenticatedUserSchema.parse(response.locals.user);
      const { workspaceId, userId } = workspaceMemberParametersSchema.parse(
        request.params,
      );
      await workspaceService.removeMember(user.id, workspaceId, userId);

      response.status(204).send();
    },
  );

  router.post('/', trustedOrigin, async (request, response) => {
    const user = authenticatedUserSchema.parse(response.locals.user);
    const input = parseRequestBody(request, createWorkspaceRequestSchema);
    const workspace = await workspaceService.create(user.id, input);
    response.status(201).json(workspaceSummarySchema.parse(workspace));
  });

  return router;
}
