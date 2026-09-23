import type { UserProfile } from '@creatorpilot/contracts';

// Storage operation required by the profile service.
export interface ProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | undefined>;
}
