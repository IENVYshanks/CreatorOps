import type { UserProfile } from '@creatorpilot/contracts';

import { ApplicationError } from '../../shared/application-error.js';
import type { ProfileRepository } from './profile-repository.js';

export class ProfileService {
  public constructor(private readonly repository: ProfileRepository) {}

  public async getForUser(userId: string): Promise<UserProfile> {
    const profile = await this.repository.findByUserId(userId);

    if (!profile) {
      throw new ApplicationError(
        404,
        'PROFILE_NOT_FOUND',
        'User profile not found',
      );
    }

    return profile;
  }
}
