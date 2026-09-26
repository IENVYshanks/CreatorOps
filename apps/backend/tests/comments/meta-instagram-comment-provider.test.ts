import { describe, expect, it, vi } from 'vitest';

import { InstagramCommentProviderError } from '../../src/modules/comments/providers/instagram-comment-provider.js';
import { MetaInstagramCommentProvider } from '../../src/modules/comments/providers/meta-instagram-comment-provider.js';

describe('Meta Instagram comment provider', () => {
  it('fetches a comment page without placing the token in the URL', async () => {
    const request = vi.fn((input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/v26.0/post-1/comments');
      expect(url.searchParams.get('fields')).toBe('id,text');
      expect(url.searchParams.get('limit')).toBe('50');
      expect(url.searchParams.has('access_token')).toBe(false);
      expect(init?.headers).toEqual({ Authorization: 'Bearer secret-token' });

      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              { id: 'comment-1', text: 'Amazing post!' },
              { id: 'comment-2', text: 'When was this posted?' },
            ],
            paging: {
              cursors: { after: 'next-page' },
              next: 'https://graph.instagram.com/v26.0/post-1/comments?after=next-page&access_token=must-not-be-followed',
            },
          }),
        ),
      );
    });
    const provider = new MetaInstagramCommentProvider({
      apiVersion: 'v26.0',
      fetch: request as typeof fetch,
    });

    await expect(
      provider.fetchPage({
        accessToken: 'secret-token',
        instagramPostId: 'post-1',
      }),
    ).resolves.toEqual({
      comments: [
        { id: 'comment-1', text: 'Amazing post!' },
        { id: 'comment-2', text: 'When was this posted?' },
      ],
      nextCursor: 'next-page',
    });
  });

  it('uses the supplied cursor and ends when Meta has no next page', async () => {
    const request = vi.fn((input: string | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get('after')).toBe('page-2');
      return Promise.resolve(
        new Response(JSON.stringify({ data: [{ id: 3, text: 'Nice!' }] })),
      );
    });
    const provider = new MetaInstagramCommentProvider({
      apiVersion: 'v26.0',
      fetch: request as typeof fetch,
    });

    await expect(
      provider.fetchPage({
        accessToken: 'secret-token',
        instagramPostId: 'post-1',
        cursor: 'page-2',
      }),
    ).resolves.toEqual({
      comments: [{ id: '3', text: 'Nice!' }],
    });
  });

  it('rejects failed requests and unsafe pagination URLs', async () => {
    const failedProvider = new MetaInstagramCommentProvider({
      apiVersion: 'v26.0',
      fetch: vi
        .fn()
        .mockResolvedValue(new Response('{}', { status: 429 })) as typeof fetch,
    });
    await expect(
      failedProvider.fetchPage({
        accessToken: 'secret-token',
        instagramPostId: 'post-1',
      }),
    ).rejects.toThrow(InstagramCommentProviderError);

    const unsafeProvider = new MetaInstagramCommentProvider({
      apiVersion: 'v26.0',
      fetch: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [],
            paging: {
              cursors: { after: 'next-page' },
              next: 'https://malicious.example/comments?after=next-page',
            },
          }),
        ),
      ) as typeof fetch,
    });
    await expect(
      unsafeProvider.fetchPage({
        accessToken: 'secret-token',
        instagramPostId: 'post-1',
      }),
    ).rejects.toThrow('invalid comment pagination');
  });
});
