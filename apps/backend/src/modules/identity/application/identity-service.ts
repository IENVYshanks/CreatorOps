import type {
  AuthenticatedUser,
  LoginRequest,
  RegisterRequest,
} from '@creatorpilot/contracts';

import { ApplicationError } from '../../../shared/application-error.js';
import type { AuthResult } from '../domain/identity.js';
import type {
  IdentityRepository,
  PasswordHasher,
  SessionTokenManager,
} from './ports.js';

export class IdentityService {
  public constructor(
    private readonly repository: IdentityRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionTokens: SessionTokenManager,
    private readonly sessionTtlHours: number,
  ) {}

  public async register(input: RegisterRequest): Promise<AuthResult> {
    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.repository.createUser(input.email, passwordHash);

    if (!user) {
      throw new ApplicationError(
        409,
        'EMAIL_ALREADY_REGISTERED',
        'An account with this email already exists',
      );
    }

    return this.createAuthenticatedSession(user);
  }

  public async login(input: LoginRequest): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(input.email);

    if (!user) {
      await this.passwordHasher.hash(input.password);
      throw this.invalidCredentialsError();
    }

    const passwordIsValid = await this.passwordHasher.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordIsValid) {
      throw this.invalidCredentialsError();
    }

    return this.createAuthenticatedSession(user);
  }

  public async authenticate(token: string): Promise<AuthenticatedUser> {
    const user = await this.repository.findUserBySession(
      this.sessionTokens.hash(token),
      new Date(),
    );

    if (!user) {
      throw new ApplicationError(
        401,
        'UNAUTHENTICATED',
        'Authentication required',
      );
    }

    return user;
  }

  public async logout(token: string): Promise<void> {
    await this.repository.deleteSession(this.sessionTokens.hash(token));
  }

  private async createAuthenticatedSession(
    user: AuthenticatedUser,
  ): Promise<AuthResult> {
    const token = this.sessionTokens.create();
    const expiresAt = new Date(
      Date.now() + this.sessionTtlHours * 60 * 60 * 1_000,
    );

    await this.repository.createSession(
      user.id,
      this.sessionTokens.hash(token),
      expiresAt,
    );

    return {
      user: { id: user.id, email: user.email },
      session: { token, expiresAt },
    };
  }

  private invalidCredentialsError(): ApplicationError {
    return new ApplicationError(
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect',
    );
  }
}
