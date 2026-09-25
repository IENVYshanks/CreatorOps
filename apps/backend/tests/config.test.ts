import { describe, expect, it } from 'vitest';

import { loadEnvironment } from '../src/config.js';

describe('environment configuration', () => {
  it('provides protocol-compatible local defaults', () => {
    const environment = loadEnvironment({});

    expect(environment.PORT).toBe(3001);
    expect(environment.DATABASE_URL).toContain('postgresql://');
  });

  it('rejects insecure production defaults', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'production' })).toThrow();
  });

  it('accepts explicit secure production settings', () => {
    const environment = loadEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL:
        'postgresql://service:secret@database.internal/creatorpilot',
      APP_ORIGIN: 'https://app.example.com',
    });

    expect(environment.NODE_ENV).toBe('production');
  });

  it('supports a development-only mock Instagram provider', () => {
    const environment = loadEnvironment({ INSTAGRAM_PROVIDER: 'mock' });

    expect(environment.INSTAGRAM_PROVIDER).toBe('mock');
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgresql://service:secret@database.internal/creatorpilot',
        APP_ORIGIN: 'https://app.example.com',
        INSTAGRAM_PROVIDER: 'mock',
      }),
    ).toThrow();
  });

  it('requires complete Instagram settings for the Meta provider', () => {
    expect(() => loadEnvironment({ INSTAGRAM_PROVIDER: 'meta' })).toThrow();

    const environment = loadEnvironment({
      INSTAGRAM_PROVIDER: 'meta',
      INSTAGRAM_APP_ID: 'app-id',
      INSTAGRAM_APP_SECRET: 'app-secret',
      INSTAGRAM_REDIRECT_URI:
        'http://localhost:3000/api/connections/instagram/callback',
      INSTAGRAM_API_VERSION: 'v26.0',
      CONNECTION_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    });

    expect(environment.INSTAGRAM_PROVIDER).toBe('meta');
  });
});
