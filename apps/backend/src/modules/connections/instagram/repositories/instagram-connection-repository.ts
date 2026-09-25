import type { PlatformConnection } from '@creatorpilot/contracts';

export interface AuthorizationStateRecord {
  stateHash: string;
  workspaceId: string;
  initiatedByUserId: string;
  expiresAt: Date;
}

export interface EncryptedToken {
  ciphertext: string;
  initializationVector: string;
  authenticationTag: string;
}

export interface SaveInstagramConnectionInput {
  workspaceId: string;
  accountId: string;
  username: string;
  accessToken: EncryptedToken;
  accessTokenExpiresAt?: Date;
}

export interface InstagramConnectionRepository {
  createAuthorizationState(state: AuthorizationStateRecord): Promise<void>;
  consumeAuthorizationState(
    stateHash: string,
    now: Date,
  ): Promise<AuthorizationStateRecord | undefined>;
  saveInstagramConnection(
    input: SaveInstagramConnectionInput,
  ): Promise<PlatformConnection>;
  listForWorkspace(workspaceId: string): Promise<PlatformConnection[]>;
}
