import {
  InstagramProviderError,
  type InstagramAuthorization,
  type InstagramProvider,
} from './instagram-provider.js';

export interface MockInstagramProviderOptions {
  applicationOrigin: string;
  accountId?: string;
  username?: string;
}

const mockAuthorizationCode = 'mock-authorization-code';

export class MockInstagramProvider implements InstagramProvider {
  public constructor(private readonly options: MockInstagramProviderOptions) {}

  public createAuthorizationUrl(state: string): string {
    const url = new URL(
      '/api/connections/instagram/callback',
      this.options.applicationOrigin,
    );
    url.searchParams.set('code', mockAuthorizationCode);
    url.searchParams.set('state', state);
    return url.toString();
  }

  public exchangeAuthorizationCode(
    code: string,
  ): Promise<InstagramAuthorization> {
    if (code !== mockAuthorizationCode) {
      return Promise.reject(
        new InstagramProviderError('Invalid mock authorization code'),
      );
    }

    return Promise.resolve({
      accountId: this.options.accountId ?? 'mock-instagram-account',
      username: this.options.username ?? 'creatorpilot_demo',
      accessToken: 'mock-access-token',
    });
  }
}
