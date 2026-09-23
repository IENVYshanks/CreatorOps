import type { AuthenticatedUser } from '@creatorpilot/contracts';

// Read-only user lookup exposed to other application modules.
export interface UserDirectory {
  findUserByEmail(email: string): Promise<AuthenticatedUser | undefined>;
}
