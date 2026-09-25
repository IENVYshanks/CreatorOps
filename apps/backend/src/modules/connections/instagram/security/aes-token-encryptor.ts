import { createCipheriv, randomBytes } from 'node:crypto';

import type { EncryptedToken } from '../repositories/instagram-connection-repository.js';

export interface TokenEncryptor {
  encrypt(value: string): EncryptedToken;
}

export class AesTokenEncryptor implements TokenEncryptor {
  private readonly key: Buffer;

  public constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');

    if (this.key.length !== 32) {
      throw new Error('Token encryption key must decode to exactly 32 bytes');
    }
  }

  public encrypt(value: string): EncryptedToken {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.key,
      initializationVector,
    );
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext: ciphertext.toString('base64'),
      initializationVector: initializationVector.toString('base64'),
      authenticationTag: cipher.getAuthTag().toString('base64'),
    };
  }
}
