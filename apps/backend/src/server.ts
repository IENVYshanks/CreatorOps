import { createHash } from 'node:crypto';

import pino from 'pino';

import { createApp } from './app.js';
import { loadEnvironment } from './config.js';
import { createDatabaseConnection } from './database/client.js';
import type { InstagramProvider } from './modules/connections/instagram/providers/instagram-provider.js';
import { MetaInstagramProvider } from './modules/connections/instagram/providers/meta-instagram-provider.js';
import { MockInstagramProvider } from './modules/connections/instagram/providers/mock-instagram-provider.js';
import { PostgresInstagramConnectionRepository } from './modules/connections/instagram/repositories/postgres-instagram-connection-repository.js';
import { AesTokenEncryptor } from './modules/connections/instagram/security/aes-token-encryptor.js';
import { InstagramConnectionService } from './modules/connections/instagram/services/instagram-connection-service.js';
import { PostgresContentRepository } from './modules/content/repositories/postgres-content-repository.js';
import { ContentService } from './modules/content/services/content-service.js';
import { ArgonPasswordHasher } from './modules/identity/passwords/argon2-password-hasher.js';
import { AuthService } from './modules/identity/authentication/auth-service.js';
import { PostgresAuthRepository } from './modules/identity/database/postgres-auth-repository.js';
import { PostgresProfileRepository } from './modules/identity/database/postgres-profile-repository.js';
import { ProfileService } from './modules/identity/profiles/profile-service.js';
import { SecureSessionTokens } from './modules/identity/sessions/secure-session-tokens.js';
import { PostgresWorkspaceRepository } from './modules/workspaces/postgres-workspace-repository.js';
import { WorkspaceService } from './modules/workspaces/workspace-service.js';

const environment = loadEnvironment();
const logger = pino({ level: environment.LOG_LEVEL });
const databaseConnection = createDatabaseConnection(environment.DATABASE_URL);
const authRepository = new PostgresAuthRepository(databaseConnection.database);
const authService = new AuthService(
  authRepository,
  new ArgonPasswordHasher(),
  new SecureSessionTokens(),
  environment.SESSION_TTL_HOURS,
);
const workspaceService = new WorkspaceService(
  new PostgresWorkspaceRepository(databaseConnection.database),
  authRepository,
);
const profileService = new ProfileService(
  new PostgresProfileRepository(databaseConnection.database),
);
const contentService = new ContentService(
  new PostgresContentRepository(databaseConnection.database),
  workspaceService,
);
const instagramProvider: InstagramProvider | undefined =
  environment.INSTAGRAM_PROVIDER === 'meta'
    ? new MetaInstagramProvider({
        appId: environment.INSTAGRAM_APP_ID,
        appSecret: environment.INSTAGRAM_APP_SECRET,
        redirectUri: environment.INSTAGRAM_REDIRECT_URI,
        apiVersion: environment.INSTAGRAM_API_VERSION,
      })
    : environment.INSTAGRAM_PROVIDER === 'mock'
      ? new MockInstagramProvider({ applicationOrigin: environment.APP_ORIGIN })
      : undefined;
const tokenEncryptionKey =
  environment.INSTAGRAM_PROVIDER === 'meta'
    ? environment.CONNECTION_TOKEN_ENCRYPTION_KEY
    : createHash('sha256')
        .update('creatorpilot-development-mock-instagram-token')
        .digest('base64');
const connectionService = instagramProvider
  ? new InstagramConnectionService(
      new PostgresInstagramConnectionRepository(databaseConnection.database),
      workspaceService,
      instagramProvider,
      new AesTokenEncryptor(tokenEncryptionKey),
      environment.APP_ORIGIN,
    )
  : undefined;
const app = createApp({
  authService,
  workspaceService,
  profileService,
  contentService,
  ...(connectionService ? { connectionService } : {}),
  applicationOrigin: environment.APP_ORIGIN,
  requireTrustedOrigin: environment.NODE_ENV === 'production',
  cookie: {
    name:
      environment.NODE_ENV === 'production'
        ? '__Host-creator_session'
        : 'creator_session',
    secure: environment.NODE_ENV === 'production',
  },
});

const server = app.listen(environment.PORT, () => {
  logger.info(
    {
      environment: environment.NODE_ENV,
      port: environment.PORT,
    },
    'HTTP server started',
  );
});

function shutDown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'Stopping HTTP server');

  server.close((error) => {
    if (error) {
      logger.error({ error }, 'HTTP server shutdown failed');
      process.exitCode = 1;
    }

    void databaseConnection.close().catch((databaseError: unknown) => {
      logger.error({ error: databaseError }, 'Database shutdown failed');
      process.exitCode = 1;
    });
  });
}

process.once('SIGINT', shutDown);
process.once('SIGTERM', shutDown);
