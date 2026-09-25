import { createHash, randomBytes } from 'node:crypto';

import type {
  InstagramAuthorizationResponse,
  PlatformConnection,
  WorkspaceDetails,
} from '@creatorpilot/contracts';

import { ApplicationError } from '../../../../shared/application-error.js';
import {
  InstagramProviderError,
  type InstagramProvider,
} from '../providers/instagram-provider.js';
import type { InstagramConnectionRepository } from '../repositories/instagram-connection-repository.js';
import type { TokenEncryptor } from '../security/aes-token-encryptor.js';

export interface WorkspaceAccess {
  getForUser(userId: string, workspaceId: string): Promise<WorkspaceDetails>;
}

export class InstagramConnectionService {
  public constructor(
    private readonly repository: InstagramConnectionRepository,
    private readonly workspaceAccess: WorkspaceAccess,
    private readonly instagram: InstagramProvider,
    private readonly tokenEncryptor: TokenEncryptor,
    private readonly applicationOrigin: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async beginInstagramAuthorization(
    userId: string,
    workspaceId: string,
  ): Promise<InstagramAuthorizationResponse> {
    const workspace = await this.workspaceAccess.getForUser(
      userId,
      workspaceId,
    );

    if (workspace.role !== 'owner') {
      throw new ApplicationError(
        403,
        'WORKSPACE_OWNER_REQUIRED',
        'Only a workspace owner can connect Instagram',
      );
    }

    const state = randomBytes(32).toString('base64url');
    const createdAt = this.now();
    await this.repository.createAuthorizationState({
      stateHash: hashState(state),
      workspaceId,
      initiatedByUserId: userId,
      expiresAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
    });

    return { authorizationUrl: this.instagram.createAuthorizationUrl(state) };
  }

  public async completeInstagramAuthorization(
    code: string,
    state: string,
  ): Promise<string> {
    const authorizationState = await this.repository.consumeAuthorizationState(
      hashState(state),
      this.now(),
    );

    if (!authorizationState) {
      throw new ApplicationError(
        400,
        'INVALID_OAUTH_STATE',
        'The Instagram authorization request is invalid or expired',
      );
    }

    try {
      const authorization =
        await this.instagram.exchangeAuthorizationCode(code);
      await this.repository.saveInstagramConnection({
        workspaceId: authorizationState.workspaceId,
        accountId: authorization.accountId,
        username: authorization.username,
        accessToken: this.tokenEncryptor.encrypt(authorization.accessToken),
        ...(authorization.accessTokenExpiresAt === undefined
          ? {}
          : { accessTokenExpiresAt: authorization.accessTokenExpiresAt }),
      });
    } catch (error: unknown) {
      if (error instanceof InstagramProviderError) {
        throw new ApplicationError(
          502,
          'INSTAGRAM_CONNECTION_FAILED',
          'Instagram could not be connected',
        );
      }

      throw error;
    }

    const returnUrl = new URL(
      `/workspaces/${authorizationState.workspaceId}`,
      this.applicationOrigin,
    );
    returnUrl.searchParams.set('instagram', 'connected');
    return returnUrl.toString();
  }

  public async listForWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<PlatformConnection[]> {
    await this.workspaceAccess.getForUser(userId, workspaceId);
    return this.repository.listForWorkspace(workspaceId);
  }
}

function hashState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}
