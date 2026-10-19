import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import type { Logger } from 'pino';
import { healthRoutes } from './modules/health/index';
import type { AppConfig } from './platform/config/index';
import type { Db } from './platform/db/index';
import { errorHandlingPlugin } from './platform/http/errors';

export type AppDependencies = {
  config: AppConfig;
  logger: Logger;
  db: Db;
};

export async function buildApp({ config, logger, db }: AppDependencies) {
  const app = Fastify({
    loggerInstance: logger,
    genReqId: () => randomUUID(),
    bodyLimit: 1024 * 1024,
    trustProxy: true,
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  await app.register(errorHandlingPlugin);
  await app.register(healthRoutes, { prefix: '/api/v1', db });

  return app;
}
