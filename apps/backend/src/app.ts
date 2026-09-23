import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from 'express';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';

const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

const healthHandler: RequestHandler = (_request, response) => {
  response.status(200).json(healthResponseSchema.parse({ status: 'ok' }));
};

const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: 'Not Found',
  });
};

const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  request.log.error({ error }, 'Unhandled request error');

  response.status(500).json({
    error: 'Internal Server Error',
  });
};

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', healthHandler);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
