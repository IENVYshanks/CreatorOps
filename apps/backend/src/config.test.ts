import { describe, expect, it } from 'vitest';

import { loadEnvironment } from './config.js';

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
});
