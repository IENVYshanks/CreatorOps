import pino from 'pino';

import { createApp } from './app.js';
import { loadEnvironment } from './config.js';
import { createDatabaseConnection } from './database/client.js';
import { IdentityService } from './modules/identity/application/identity-service.js';
import { ArgonPasswordHasher } from './modules/identity/infrastructure/argon-password-hasher.js';
import { DrizzleIdentityRepository } from './modules/identity/infrastructure/drizzle-identity-repository.js';
import { SecureSessionTokens } from './modules/identity/infrastructure/secure-session-tokens.js';
import { WorkspaceService } from './modules/workspaces/application/workspace-service.js';
import { DrizzleWorkspaceRepository } from './modules/workspaces/infrastructure/drizzle-workspace-repository.js';

const environment = loadEnvironment();
const logger = pino({ level: environment.LOG_LEVEL });
const databaseConnection = createDatabaseConnection(environment.DATABASE_URL);
const identityService = new IdentityService(
  new DrizzleIdentityRepository(databaseConnection.database),
  new ArgonPasswordHasher(),
  new SecureSessionTokens(),
  environment.SESSION_TTL_HOURS,
);
const workspaceService = new WorkspaceService(
  new DrizzleWorkspaceRepository(databaseConnection.database),
);
const app = createApp({
  identityService,
  workspaceService,
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
