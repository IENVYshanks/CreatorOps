import { describe, expect, it } from 'vitest';

import {
  resolveNgrokCommand,
  resolveTunnelUrl,
} from '../../src/tooling/start-dev-tunnel.js';

describe('development tunnel configuration', () => {
  it('skips ngrok when the Meta provider is not enabled', () => {
    expect(resolveTunnelUrl({ INSTAGRAM_PROVIDER: 'mock' })).toBeUndefined();
  });

  it('derives the fixed ngrok endpoint from the Instagram callback', () => {
    expect(
      resolveTunnelUrl({
        INSTAGRAM_PROVIDER: 'meta',
        INSTAGRAM_REDIRECT_URI:
          'https://creator.ngrok-free.app/api/connections/instagram/callback',
      }),
    ).toBe('https://creator.ngrok-free.app');
  });

  it.each([
    undefined,
    'http://localhost:3000/api/connections/instagram/callback',
    'https://creator.ngrok-free.app/wrong-callback',
    'https://creator.ngrok-free.app/api/connections/instagram/callback?extra=true',
  ])('rejects an unusable Meta redirect URI: %s', (redirectUri) => {
    expect(() =>
      resolveTunnelUrl({
        INSTAGRAM_PROVIDER: 'meta',
        INSTAGRAM_REDIRECT_URI: redirectUri,
      }),
    ).toThrow();
  });

  it('uses an explicit ngrok executable when configured', () => {
    expect(resolveNgrokCommand({ NGROK_BIN: '  C:\\tools\\ngrok.exe  ' })).toBe(
      'C:\\tools\\ngrok.exe',
    );
    expect(resolveNgrokCommand({})).toBe('ngrok');
  });
});
