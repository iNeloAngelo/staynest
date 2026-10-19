import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import type { Logger } from 'pino';
import { healthRoutes } from './modules/health/index';
import type { AppConfig } from './platform/config/index';
import type { Db } from './platform/db/index';
import { problemErrorHandler, problemNotFoundHandler } from './platform/http/errors';

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
    trustProxy: config.trustProxy,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    xFrameOptions: { action: 'deny' },
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  });

  app.setErrorHandler(problemErrorHandler);
  app.setNotFoundHandler(problemNotFoundHandler);

  await app.register(healthRoutes, { prefix: '/api/v1', db });

  return app;
}
