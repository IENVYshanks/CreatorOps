import type { AuthenticatedUser } from '@creatorpilot/contracts';

// Internal authentication types that must not leak into HTTP contracts.
export interface StoredUser extends AuthenticatedUser {
  passwordHash: string;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export interface AuthenticationResult {
  user: AuthenticatedUser;
  session: CreatedSession;
}
