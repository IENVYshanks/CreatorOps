export interface InstagramComment {
  id: string;
  text: string;
}

export interface InstagramCommentPage {
  comments: InstagramComment[];
  nextCursor?: string;
}

export interface FetchInstagramCommentPageInput {
  accessToken: string;
  instagramPostId: string;
  cursor?: string;
}

export interface InstagramCommentProvider {
  fetchPage(
    input: FetchInstagramCommentPageInput,
  ): Promise<InstagramCommentPage>;
}

export class InstagramCommentProviderError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InstagramCommentProviderError';
  }
}
