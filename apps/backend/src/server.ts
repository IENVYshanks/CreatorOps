import pino from 'pino';

import { createApp } from './app.js';
import { loadEnvironment } from './config.js';
import { createDatabaseConnection } from './database/client.js';
import { ArgonPasswordHasher } from './modules/identity/argon2-password-hasher.js';
import { AuthService } from './modules/identity/auth-service.js';
import { PostgresAuthRepository } from './modules/identity/postgres-auth-repository.js';
import { PostgresProfileRepository } from './modules/identity/postgres-profile-repository.js';
import { ProfileService } from './modules/identity/profile-service.js';
import { SecureSessionTokens } from './modules/identity/secure-session-tokens.js';
import { PostgresWorkspaceRepository } from './modules/workspaces/postgres-workspace-repository.js';
import { WorkspaceService } from './modules/workspaces/workspace-service.js';

const environment = loadEnvironment();
const logger = pino({ level: environment.LOG_LEVEL });
const databaseConnection = createDatabaseConnection(environment.DATABASE_URL);
const authService = new AuthService(
  new PostgresAuthRepository(databaseConnection.database),
  new ArgonPasswordHasher(),
  new SecureSessionTokens(),
  environment.SESSION_TTL_HOURS,
);
const workspaceService = new WorkspaceService(
  new PostgresWorkspaceRepository(databaseConnection.database),
);
const profileService = new ProfileService(
  new PostgresProfileRepository(databaseConnection.database),
);
const app = createApp({
  authService,
  workspaceService,
  profileService,
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
