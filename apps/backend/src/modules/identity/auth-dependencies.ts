import type { AuthenticatedUser } from '@creatorpilot/contracts';

import type { StoredUser } from './auth-types.js';

export interface AuthRepository {
  createUser(
    email: string,
    passwordHash: string,
  ): Promise<StoredUser | undefined>;
  findUserByEmail(email: string): Promise<StoredUser | undefined>;
  createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  findUserBySession(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedUser | undefined>;
  deleteSession(tokenHash: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export interface SessionTokenManager {
  create(): string;
  hash(token: string): string;
}
