export interface InstagramAuthorization {
  accountId: string;
  username: string;
  accessToken: string;
  accessTokenExpiresAt?: Date;
}

export interface InstagramProvider {
  createAuthorizationUrl(state: string): string;
  exchangeAuthorizationCode(code: string): Promise<InstagramAuthorization>;
}

export class InstagramProviderError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InstagramProviderError';
  }
}
