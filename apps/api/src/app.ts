import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import type { Logger } from 'pino';
import { authRoutes } from './modules/auth/index';
import type { AuthOptions } from './modules/auth/index';
import { healthRoutes } from './modules/health/index';
import type { AppConfig } from './platform/config/index';
import type { Db } from './platform/db/index';
import { createEventBus } from './platform/events/index';
import type { EventBus } from './platform/events/index';
import { problemErrorHandler, problemNotFoundHandler } from './platform/http/errors';
import { createOriginGuard } from './platform/http/origin';
import { createNoopMailer } from './platform/mailer/index';
import type { Mailer } from './platform/mailer/index';

export type AppDependencies = {
  config: AppConfig;
  logger: Logger;
  db: Db;
  mailer?: Mailer;
  events?: EventBus;
  auth?: AuthOptions;
};

export async function buildApp({ config, logger, db, ...deps }: AppDependencies) {
  const app = Fastify({
    loggerInstance: logger,
    genReqId: () => randomUUID(),
    bodyLimit: 1024 * 1024,
    trustProxy: config.trustProxy,
  });

  const mailer = deps.mailer ?? createNoopMailer(logger);
  const events = deps.events ?? createEventBus(logger);

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

  await app.register(cookie);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  });

  app.addHook('onRequest', createOriginGuard(config.corsOrigins));

  app.setErrorHandler(problemErrorHandler);
  app.setNotFoundHandler(problemNotFoundHandler);

  app.addHook('onClose', async () => {
    mailer.close();
  });

  await app.register(healthRoutes, { prefix: '/api/v1', db });
  await app.register(authRoutes, {
    prefix: '/api/v1',
    config,
    db,
    logger,
    mailer,
    events,
    auth: deps.auth,
  });

  return app;
}
