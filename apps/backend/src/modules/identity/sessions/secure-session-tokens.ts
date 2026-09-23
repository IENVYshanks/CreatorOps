import { createHash, randomBytes } from 'node:crypto';

import type { SessionTokenManager } from '../authentication/auth-dependencies.js';

export class SecureSessionTokens implements SessionTokenManager {
  public create(): string {
    return randomBytes(32).toString('base64url');
  }

  public hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
