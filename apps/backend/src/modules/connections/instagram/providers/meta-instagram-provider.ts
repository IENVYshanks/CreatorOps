import { z } from 'zod';

import {
  InstagramProviderError,
  type InstagramAuthorization,
  type InstagramProvider,
} from './instagram-provider.js';

const shortLivedTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  user_id: z.coerce.string().min(1),
});

const longLivedTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
});

const instagramAccountResponseSchema = z.object({
  id: z.coerce.string().min(1),
  username: z.string().min(1),
});

export interface MetaInstagramProviderOptions {
  appId: string;
  appSecret: string;
  redirectUri: string;
  apiVersion: string;
  requestTimeoutMilliseconds?: number;
  fetch?: typeof fetch;
}

export class MetaInstagramProvider implements InstagramProvider {
  private readonly request: typeof fetch;
  private readonly requestTimeoutMilliseconds: number;

  public constructor(private readonly options: MetaInstagramProviderOptions) {
    this.request = options.fetch ?? fetch;
    this.requestTimeoutMilliseconds =
      options.requestTimeoutMilliseconds ?? 10_000;
  }

  public createAuthorizationUrl(state: string): string {
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.searchParams.set('client_id', this.options.appId);
    url.searchParams.set('redirect_uri', this.options.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set(
      'scope',
      [
        'instagram_business_basic',
        'instagram_business_content_publish',
        'instagram_business_manage_comments',
        'instagram_business_manage_insights',
        'instagram_business_manage_messages',
      ].join(','),
    );
    url.searchParams.set('state', state);
    url.searchParams.set('enable_fb_login', '0');
    url.searchParams.set('force_authentication', '1');
    return url.toString();
  }

  public async exchangeAuthorizationCode(
    code: string,
  ): Promise<InstagramAuthorization> {
    const shortLivedToken = await this.requestShortLivedToken(code);
    const longLivedToken = await this.requestLongLivedToken(
      shortLivedToken.access_token,
    );
    const account = await this.requestAccount(longLivedToken.access_token);

    return {
      accountId: account.id,
      username: account.username,
      accessToken: longLivedToken.access_token,
      ...(longLivedToken.expires_in === undefined
        ? {}
        : {
            accessTokenExpiresAt: new Date(
              Date.now() + longLivedToken.expires_in * 1000,
            ),
          }),
    };
  }

  private async requestShortLivedToken(
    code: string,
  ): Promise<z.infer<typeof shortLivedTokenResponseSchema>> {
    const body = new FormData();
    body.set('client_id', this.options.appId);
    body.set('client_secret', this.options.appSecret);
    body.set('grant_type', 'authorization_code');
    body.set('redirect_uri', this.options.redirectUri);
    body.set('code', code);

    return this.requestJson(
      'https://api.instagram.com/oauth/access_token',
      shortLivedTokenResponseSchema,
      { method: 'POST', body },
    );
  }

  private async requestLongLivedToken(
    shortLivedAccessToken: string,
  ): Promise<z.infer<typeof longLivedTokenResponseSchema>> {
    const url = new URL('https://graph.instagram.com/access_token');
    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', this.options.appSecret);
    url.searchParams.set('access_token', shortLivedAccessToken);

    return this.requestJson(url, longLivedTokenResponseSchema);
  }

  private async requestAccount(
    accessToken: string,
  ): Promise<z.infer<typeof instagramAccountResponseSchema>> {
    const url = new URL(
      `https://graph.instagram.com/${this.options.apiVersion}/me`,
    );
    url.searchParams.set('fields', 'id,username');
    url.searchParams.set('access_token', accessToken);

    return this.requestJson(url, instagramAccountResponseSchema);
  }

  private async requestJson<T>(
    url: string | URL,
    schema: z.ZodType<T>,
    init: RequestInit = {},
  ): Promise<T> {
    try {
      const response = await this.request(url, {
        ...init,
        signal: AbortSignal.timeout(this.requestTimeoutMilliseconds),
      });

      if (!response.ok) {
        throw new InstagramProviderError(
          `Instagram returned HTTP ${String(response.status)}`,
        );
      }

      return schema.parse(await response.json());
    } catch (error: unknown) {
      if (error instanceof InstagramProviderError) {
        throw error;
      }

      throw new InstagramProviderError('Instagram request failed');
    }
  }
}
