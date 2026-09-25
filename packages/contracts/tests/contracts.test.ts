import { describe, expect, it } from 'vitest';

import {
  addWorkspaceMemberRequestSchema,
  createWorkspaceRequestSchema,
  createContentDraftRequestSchema,
  instagramAuthorizationResponseSchema,
  platformConnectionSchema,
  registerRequestSchema,
  workspaceIdParametersSchema,
  workspaceMemberParametersSchema,
  updateContentDraftRequestSchema,
} from '../src/index.js';

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

  it('validates public Instagram connection responses without exposing tokens', () => {
    expect(
      instagramAuthorizationResponseSchema.parse({
        authorizationUrl:
          'https://www.instagram.com/oauth/authorize?state=test',
      }),
    ).toBeDefined();
    expect(
      platformConnectionSchema.parse({
        id: 'd69a9d2d-cef8-454a-b6e3-9d7a50b6f70d',
        platform: 'instagram',
        accountId: '17841400000000000',
        username: 'creator',
        connectedAt: '2026-09-23T10:00:00.000Z',
        accessToken: 'must-not-be-part-of-the-contract',
      }),
    ).not.toHaveProperty('accessToken');
  });

  it('validates content draft creation and non-empty updates', () => {
    expect(
      createContentDraftRequestSchema.parse({
        title: 'Launch post',
        instagram: { caption: 'Launching today.' },
      }),
    ).toMatchObject({ title: 'Launch post', status: 'draft' });

    expect(() => updateContentDraftRequestSchema.parse({})).toThrow();
  });
});
