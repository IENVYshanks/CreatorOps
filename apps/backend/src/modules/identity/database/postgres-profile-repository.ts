import type { UserProfile } from '@creatorpilot/contracts';
import { eq } from 'drizzle-orm';

import type { AppDatabase } from '../../../database/client.js';
import type { ProfileRepository } from '../profiles/profile-repository.js';
import { users } from './identity-database-schema.js';

export class PostgresProfileRepository implements ProfileRepository {
  public constructor(private readonly database: AppDatabase) {}

  public async findByUserId(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await this.database
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!profile) {
      return undefined;
    }

    return {
      id: profile.id,
      email: profile.email,
      createdAt: profile.createdAt.toISOString(),
    };
  }
}
