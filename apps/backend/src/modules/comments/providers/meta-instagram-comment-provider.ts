import { z } from 'zod';

import {
  InstagramCommentProviderError,
  type FetchInstagramCommentPageInput,
  type InstagramCommentPage,
  type InstagramCommentProvider,
} from './instagram-comment-provider.js';

const commentPageSchema = z.object({
  data: z.array(
    z.object({
      id: z.coerce.string().min(1),
      text: z.string(),
    }),
  ),
  paging: z
    .object({
      cursors: z
        .object({
          after: z.string().min(1).optional(),
        })
        .optional(),
      next: z.url().optional(),
    })
    .optional(),
});

export interface MetaInstagramCommentProviderOptions {
  apiVersion: string;
  requestTimeoutMilliseconds?: number;
  pageSize?: number;
  fetch?: typeof fetch;
}

export class MetaInstagramCommentProvider implements InstagramCommentProvider {
  private readonly request: typeof fetch;
  private readonly requestTimeoutMilliseconds: number;
  private readonly pageSize: number;

  public constructor(
    private readonly options: MetaInstagramCommentProviderOptions,
  ) {
    this.request = options.fetch ?? fetch;
    this.requestTimeoutMilliseconds =
      options.requestTimeoutMilliseconds ?? 10_000;
    this.pageSize = options.pageSize ?? 50;

    if (!Number.isInteger(this.pageSize) || this.pageSize < 1) {
      throw new Error('Instagram comment page size must be a positive integer');
    }
  }

  public async fetchPage(
    input: FetchInstagramCommentPageInput,
  ): Promise<InstagramCommentPage> {
    const url = new URL(
      `https://graph.instagram.com/${this.options.apiVersion}/${encodeURIComponent(input.instagramPostId)}/comments`,
    );
    url.searchParams.set('fields', 'id,text');
    url.searchParams.set('limit', String(this.pageSize));
    if (input.cursor !== undefined) {
      url.searchParams.set('after', input.cursor);
    }

    const page = await this.requestJson(url, input.accessToken);
    const nextCursor = resolveNextCursor(page.paging);

    return {
      comments: page.data,
      ...(nextCursor === undefined ? {} : { nextCursor }),
    };
  }

  private async requestJson(
    url: URL,
    accessToken: string,
  ): Promise<z.infer<typeof commentPageSchema>> {
    try {
      const response = await this.request(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(this.requestTimeoutMilliseconds),
      });

      if (!response.ok) {
        throw new InstagramCommentProviderError(
          `Instagram returned HTTP ${String(response.status)}`,
        );
      }

      return commentPageSchema.parse(await response.json());
    } catch (error: unknown) {
      if (error instanceof InstagramCommentProviderError) throw error;
      throw new InstagramCommentProviderError('Instagram request failed');
    }
  }
}

function resolveNextCursor(
  paging: z.infer<typeof commentPageSchema>['paging'],
): string | undefined {
  if (paging?.next === undefined) return undefined;

  const nextUrl = new URL(paging.next);
  const cursor = paging.cursors?.after;
  if (
    nextUrl.origin !== 'https://graph.instagram.com' ||
    cursor === undefined
  ) {
    throw new InstagramCommentProviderError(
      'Instagram returned invalid comment pagination',
    );
  }

  return cursor;
}
