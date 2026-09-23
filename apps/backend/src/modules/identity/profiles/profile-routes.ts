import {
  authenticatedUserSchema,
  profileResponseSchema,
} from '@creatorpilot/contracts';
import { Router, type RequestHandler } from 'express';

import type { ProfileService } from './profile-service.js';

export function createProfileRoutes(
  profileService: ProfileService,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.use(requireAuthentication);

  router.get('/', async (_request, response) => {
    const user = authenticatedUserSchema.parse(response.locals.user);
    const profile = await profileService.getForUser(user.id);

    response.json(profileResponseSchema.parse({ profile }));
  });

  return router;
}
