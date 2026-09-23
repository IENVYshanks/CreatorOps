import type { AuthenticatedUser } from '@creatorpilot/contracts';
import { and, eq, gt } from 'drizzle-orm';

import type { AppDatabase } from '../../database/client.js';
import type { AuthRepository } from './auth-dependencies.js';
import type { StoredUser } from './auth-types.js';
import { sessions, users } from './auth-database-schema.js';

export class PostgresAuthRepository implements AuthRepository {
  public constructor(private readonly database: AppDatabase) {}

  public async createUser(
    email: string,
    passwordHash: string,
  ): Promise<StoredUser | undefined> {
    try {
      const [user] = await this.database
        .insert(users)
        .values({ email, passwordHash })
        .returning({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
        });

      return user;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return undefined;
      }

      throw error;
    }
  }

  public async findUserByEmail(email: string): Promise<StoredUser | undefined> {
    const [user] = await this.database
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user;
  }

  public async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.database.insert(sessions).values({
      userId,
      tokenHash,
      expiresAt,
    });
  }

  public async findUserBySession(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedUser | undefined> {
    const [user] = await this.database
      .select({ id: users.id, email: users.email })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)),
      )
      .limit(1);

    return user;
  }

  public async deleteSession(tokenHash: string): Promise<void> {
    await this.database
      .delete(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
