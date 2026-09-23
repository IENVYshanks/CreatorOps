import { describe, expect, it } from 'vitest';

import {
  createWorkspaceRequestSchema,
  registerRequestSchema,
} from './index.js';

describe('public contracts', () => {
  it('normalizes registration email addresses', () => {
    const result = registerRequestSchema.parse({
      email: ' Creator@Example.COM ',
      password: 'a secure password',
    });

    expect(result.email).toBe('creator@example.com');
  });

  it('rejects invalid workspace names', () => {
    expect(() => createWorkspaceRequestSchema.parse({ name: ' ' })).toThrow();
  });
});
