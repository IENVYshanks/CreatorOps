import { describe, expect, it } from 'vitest';

import { MockInstagramProvider } from '../../../src/modules/connections/instagram/providers/mock-instagram-provider.js';

describe('MockInstagramProvider', () => {
  it('completes authorization without contacting Instagram', async () => {
    const provider = new MockInstagramProvider({
      applicationOrigin: 'http://localhost:3000',
    });
    const authorizationUrl = new URL(
      provider.createAuthorizationUrl('secure-state'),
    );

    expect(authorizationUrl.toString()).toBe(
      'http://localhost:3000/api/connections/instagram/callback?code=mock-authorization-code&state=secure-state',
    );
    await expect(
      provider.exchangeAuthorizationCode(
        authorizationUrl.searchParams.get('code') ?? '',
      ),
    ).resolves.toEqual({
      accountId: 'mock-instagram-account',
      username: 'creatorpilot_demo',
      accessToken: 'mock-access-token',
    });
  });

  it('rejects an unexpected authorization code', async () => {
    const provider = new MockInstagramProvider({
      applicationOrigin: 'http://localhost:3000',
    });

    await expect(
      provider.exchangeAuthorizationCode('unexpected-code'),
    ).rejects.toThrow('Invalid mock authorization code');
  });
});
