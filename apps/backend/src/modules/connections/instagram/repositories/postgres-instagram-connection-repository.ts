import type { PlatformConnection } from '@creatorpilot/contracts';
import { and, eq, gt } from 'drizzle-orm';

import type { AppDatabase } from '../../../../database/client.js';
import {
  connectionOAuthStates,
  platformConnections,
} from '../database/instagram-connection-schema.js';
import type {
  AuthorizationStateRecord,
  InstagramConnectionRepository,
  SaveInstagramConnectionInput,
} from './instagram-connection-repository.js';

export class PostgresInstagramConnectionRepository implements InstagramConnectionRepository {
  public constructor(private readonly database: AppDatabase) {}

  public async createAuthorizationState(
    state: AuthorizationStateRecord,
  ): Promise<void> {
    await this.database.insert(connectionOAuthStates).values(state);
  }

  public async consumeAuthorizationState(
    stateHash: string,
    now: Date,
  ): Promise<AuthorizationStateRecord | undefined> {
    const [state] = await this.database
      .delete(connectionOAuthStates)
      .where(
        and(
          eq(connectionOAuthStates.stateHash, stateHash),
          gt(connectionOAuthStates.expiresAt, now),
        ),
      )
      .returning({
        stateHash: connectionOAuthStates.stateHash,
        workspaceId: connectionOAuthStates.workspaceId,
        initiatedByUserId: connectionOAuthStates.initiatedByUserId,
        expiresAt: connectionOAuthStates.expiresAt,
      });

    return state;
  }

  public async saveInstagramConnection(
    input: SaveInstagramConnectionInput,
  ): Promise<PlatformConnection> {
    const now = new Date();
    const values = {
      workspaceId: input.workspaceId,
      platform: 'instagram',
      providerAccountId: input.accountId,
      username: input.username,
      encryptedAccessToken: input.accessToken.ciphertext,
      accessTokenInitializationVector: input.accessToken.initializationVector,
      accessTokenAuthenticationTag: input.accessToken.authenticationTag,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      connectedAt: now,
      updatedAt: now,
    };
    const [connection] = await this.database
      .insert(platformConnections)
      .values(values)
      .onConflictDoUpdate({
        target: [platformConnections.workspaceId, platformConnections.platform],
        set: values,
      })
      .returning({
        id: platformConnections.id,
        platform: platformConnections.platform,
        accountId: platformConnections.providerAccountId,
        username: platformConnections.username,
        connectedAt: platformConnections.connectedAt,
      });

    if (connection?.platform !== 'instagram') {
      throw new Error('Instagram connection upsert returned no record');
    }

    return {
      ...connection,
      platform: connection.platform,
      connectedAt: connection.connectedAt.toISOString(),
    };
  }

  public async listForWorkspace(
    workspaceId: string,
  ): Promise<PlatformConnection[]> {
    const connections = await this.database
      .select({
        id: platformConnections.id,
        platform: platformConnections.platform,
        accountId: platformConnections.providerAccountId,
        username: platformConnections.username,
        connectedAt: platformConnections.connectedAt,
      })
      .from(platformConnections)
      .where(eq(platformConnections.workspaceId, workspaceId));

    return connections.map((connection) => {
      if (connection.platform !== 'instagram') {
        throw new Error(`Unsupported stored platform: ${connection.platform}`);
      }

      return {
        ...connection,
        platform: connection.platform,
        connectedAt: connection.connectedAt.toISOString(),
      };
    });
  }
}
