import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { authRoutes } from './modules/auth/index';
import type { AuthOptions } from './modules/auth/index';
import { availabilityRoutes } from './modules/availability/index';
import { bookingsRoutes, paymentRoutes } from './modules/bookings/index';
import type { BookingOptions } from './modules/bookings/index';
import { catalogRoutes } from './modules/catalog/index';
import { dashboardRoutes } from './modules/dashboard/index';
import { favoritesRoutes } from './modules/favorites/index';
import { healthRoutes } from './modules/health/index';
import { listingsRoutes } from './modules/listings/index';
import { notificationsRoutes } from './modules/notifications/index';
import type { PushSender } from './modules/notifications/index';
import type { TelegramSender } from './modules/telegram/index';
import { photosRoutes } from './modules/photos/index';
import { pricingRoutes } from './modules/pricing/index';
import { profileRoutes } from './modules/profile/index';
import { seoRoutes } from './modules/seo/index';
import { telegramRoutes } from './modules/telegram/index';
import type { TelegramBot } from './modules/telegram/index';
import type { AppConfig } from './platform/config/index';
import type { Db } from './platform/db/index';
import { createEventBus } from './platform/events/index';
import type { EventBus } from './platform/events/index';
import { problemErrorHandler, problemNotFoundHandler } from './platform/http/errors';
import { isPrivateApiUrl, PRIVATE_CACHE_CONTROL } from './platform/http/cache';
import { createOriginGuard } from './platform/http/origin';
import { createNoopMailer } from './platform/mailer/index';
import type { Mailer } from './platform/mailer/index';
import { createMediaStorage } from './platform/storage/index';
import type { MediaStorage } from './platform/storage/index';

export type AppDependencies = {
  config: AppConfig;
  logger: Logger;
  db: Db;
  mailer?: Mailer;
  events?: EventBus;
  auth?: AuthOptions;
  booking?: BookingOptions;
  storage?: MediaStorage;
  push?: PushSender;
  telegramBot?: TelegramBot;
  telegramSender?: TelegramSender;
};

const HELMET_OPTIONS = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      formAction: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
  crossOriginOpenerPolicy: { policy: 'same-origin' as const },
  xFrameOptions: { action: 'deny' as const },
};

type ModuleDeps = {
  // Fastify с pino-Logger типизируется строже, чем базовый FastifyInstance;
  // на сборке модулей эта разница не важна.
  app: FastifyInstance;
  config: AppConfig;
  db: Db;
  logger: Logger;
  mailer: Mailer;
  events: EventBus;
  storage: MediaStorage;
  auth?: AuthOptions;
  booking?: BookingOptions;
  push?: PushSender;
  telegramBot?: TelegramBot;
  telegramSender?: TelegramSender;
};

async function registerModules({
  app,
  config,
  db,
  logger,
  mailer,
  events,
  storage,
  auth,
  booking,
  push,
  telegramBot,
  telegramSender,
}: ModuleDeps) {
  await app.register(healthRoutes, { prefix: '/api/v1', db });
  await app.register(seoRoutes, { db, config, storage });
  await app.register(authRoutes, {
    prefix: '/api/v1',
    config,
    db,
    logger,
    mailer,
    events,
    auth,
  });
  await app.register(catalogRoutes, { prefix: '/api/v1', db, storage });
  await app.register(availabilityRoutes, { prefix: '/api/v1', db, config });
  await app.register(pricingRoutes, { prefix: '/api/v1', db, config });
  await app.register(bookingsRoutes, { prefix: '/api/v1', config, db, events, booking });
  await app.register(paymentRoutes, { prefix: '/api/v1', config, db });
  await app.register(notificationsRoutes, {
    prefix: '/api/v1',
    config,
    db,
    logger,
    events,
    push,
    ...(telegramSender ? { telegram: telegramSender } : {}),
  });
  await app.register(listingsRoutes, { prefix: '/api/v1', config, db, events, storage, logger });
  await app.register(photosRoutes, { prefix: '/api/v1', config, db, storage, logger });
  await app.register(favoritesRoutes, { prefix: '/api/v1', config, db, storage });
  await app.register(dashboardRoutes, { prefix: '/api/v1', config, db });
  await app.register(profileRoutes, { prefix: '/api/v1', config, db, storage, logger });
  await app.register(telegramRoutes, {
    prefix: '/api/v1',
    config,
    db,
    logger,
    ...(telegramBot ? { bot: telegramBot } : {}),
  });
}

export async function buildApp({ config, logger, db, ...deps }: AppDependencies) {
  const app = Fastify({
    loggerInstance: logger,
    genReqId: () => randomUUID(),
    bodyLimit: 1024 * 1024,
    connectionTimeout: 30_000,
    trustProxy: config.trustProxy,
  });

  const mailer = deps.mailer ?? createNoopMailer(logger);
  const events = deps.events ?? createEventBus(logger);
  const storage = deps.storage ?? createMediaStorage(config.storage, logger);

  await app.register(helmet, HELMET_OPTIONS);

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (isPrivateApiUrl(request.url)) reply.header('cache-control', PRIVATE_CACHE_CONTROL);
  });

  app.addHook(
    'onRequest',
    createOriginGuard(config.corsOrigins, { allowLoopback: config.nodeEnv !== 'production' }),
  );

  app.setErrorHandler(problemErrorHandler);
  app.setNotFoundHandler(problemNotFoundHandler);

  app.addHook('onClose', async () => {
    mailer.close();
    storage.close();
  });

  await registerModules({
    app: app as unknown as FastifyInstance,
    config,
    db,
    logger,
    mailer,
    events,
    storage,
    auth: deps.auth,
    booking: deps.booking,
    push: deps.push,
    telegramBot: deps.telegramBot,
    telegramSender: deps.telegramSender,
  });

  return app;
}
