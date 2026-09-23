import { describe, expect, it } from 'vitest';

import {
  addWorkspaceMemberRequestSchema,
  createWorkspaceRequestSchema,
  registerRequestSchema,
  workspaceIdParametersSchema,
  workspaceMemberParametersSchema,
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

  it('requires a UUID workspace route parameter', () => {
    expect(() =>
      workspaceIdParametersSchema.parse({ workspaceId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('normalizes an email used to add a workspace member', () => {
    const result = addWorkspaceMemberRequestSchema.parse({
      email: ' Member@Example.COM ',
    });

    expect(result.email).toBe('member@example.com');
  });

  it('requires UUIDs for a workspace member route', () => {
    expect(() =>
      workspaceMemberParametersSchema.parse({
        workspaceId: 'not-a-uuid',
        userId: 'also-not-a-uuid',
      }),
    ).toThrow();
  });
});
