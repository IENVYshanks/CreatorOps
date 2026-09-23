import pino from 'pino';

import { createApp } from './app.js';
import { loadEnvironment } from './config.js';

const environment = loadEnvironment();
const logger = pino({ level: environment.LOG_LEVEL });
const app = createApp();

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
  });
}

process.once('SIGINT', shutDown);
process.once('SIGTERM', shutDown);
