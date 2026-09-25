import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { AesTokenEncryptor } from '../../../src/modules/connections/instagram/security/aes-token-encryptor.js';

describe('AesTokenEncryptor', () => {
  it('round-trips a token without storing plaintext', () => {
    const cipher = new AesTokenEncryptor(randomBytes(32).toString('base64'));
    const encrypted = cipher.encrypt('instagram-secret-token');

    expect(JSON.stringify(encrypted)).not.toContain('instagram-secret-token');
    expect(cipher.decrypt(encrypted)).toBe('instagram-secret-token');
  });

  it('rejects ciphertext that fails authentication', () => {
    const cipher = new AesTokenEncryptor(randomBytes(32).toString('base64'));
    const encrypted = cipher.encrypt('instagram-secret-token');

    expect(() =>
      cipher.decrypt({ ...encrypted, ciphertext: 'invalid-ciphertext' }),
    ).toThrow();
  });
});
