import { argon2id, hash, verify } from 'argon2';

import type { PasswordHasher } from '../application/ports.js';

export class ArgonPasswordHasher implements PasswordHasher {
  public hash(password: string): Promise<string> {
    return hash(password, {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  public verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
