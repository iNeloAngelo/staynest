import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type {
  DeletePushSubscriptionInput,
  MarkNotificationsReadInput,
  NotificationDto,
  NotificationListQuery,
  PushSubscriptionInput,
} from '@staynest/shared';
import {
  deletePushSubscriptionInputSchema,
  markNotificationsReadInputSchema,
  notificationListQuerySchema,
  pushSubscriptionInputSchema,
} from '@staynest/shared';
import type { Logger } from 'pino';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { EventBus } from '../../platform/events/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { AppError } from '../../platform/http/errors';
import { parseInput } from '../../platform/http/validate';
import { createAuthGuard } from '../auth/index';
import type { TelegramSender } from '../telegram/index';
import { createNotificationHub } from './hub';
import type { PushSender } from './push';
import { createNotificationService } from './service';
import type { NotificationService } from './service';

const HEARTBEAT_MS = 25_000;

type NotificationRoutesOptions = {
  config: AppConfig;
  db: Db;
  logger: Logger;
  events: EventBus;
  push?: PushSender;
  telegram?: TelegramSender;
};

type Guard = ReturnType<typeof createAuthGuard>;

function actorOf(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw new AppError({
      status: 401,
      code: 'unauthorized',
      title: 'Unauthorized',
      detail: 'Требуется авторизация.',
    });
  }

  return request.auth;
}

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'private, no-store');
  reply.header('pragma', 'no-cache');
}

function registerListRoutes(
  app: FastifyInstance,
  service: NotificationService,
  guard: Guard,
): void {
  app.get('/me/notifications', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const query = parseInput<NotificationListQuery>(notificationListQuerySchema, request.query);
    return reply.send(await service.list(actorOf(request).userId, query));
  });

  app.post('/me/notifications/read', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const input = parseInput<MarkNotificationsReadInput>(
      markNotificationsReadInputSchema,
      request.body ?? {},
    );
    return reply.send(await service.markRead(actorOf(request).userId, input));
  });
}

function registerPushRoutes(
  app: FastifyInstance,
  service: NotificationService,
  guard: Guard,
): void {
  app.get('/me/push/config', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    actorOf(request);
    return reply.send(service.pushConfig());
  });

  app.post('/me/push-subscriptions', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const input = parseInput<PushSubscriptionInput>(pushSubscriptionInputSchema, request.body);
    const result = await service.addPushSubscription(actorOf(request).userId, input);
    return reply.status(201).send(result);
  });

  app.delete('/me/push-subscriptions', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const input = parseInput<DeletePushSubscriptionInput>(
      deletePushSubscriptionInputSchema,
      request.body ?? {},
    );
    await service.removePushSubscription(actorOf(request).userId, input.endpoint);
    return reply.status(204).send();
  });
}

function openEventStream(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  service: NotificationService,
): FastifyReply {
  const raw = reply.raw;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    unsubscribe?.();
  };

  const client = {
    send(notification: NotificationDto) {
      if (closed || raw.destroyed) return;
      raw.write(
        `id: ${notification.id}\nevent: notification\ndata: ${JSON.stringify(notification)}\n\n`,
      );
    },
    close() {
      cleanup();
      if (!raw.writableEnded) raw.end();
    },
  };

  // Подписка до hijack: шестой поток получает нормальный 429, а не пустой 200.
  unsubscribe = service.openStream(userId, client);

  const inherited = reply.getHeaders() as Record<string, string | number | string[]>;
  reply.hijack();

  raw.writeHead(200, {
    ...inherited,
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'private, no-store, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  raw.write('retry: 3000\n: connected\n\n');

  heartbeat = setInterval(() => {
    if (!closed) raw.write(': ping\n\n');
  }, HEARTBEAT_MS);
  heartbeat.unref();

  request.raw.socket?.on('close', cleanup);
  raw.on('close', cleanup);
  raw.on('error', cleanup);

  return reply;
}

function registerEventStream(
  app: FastifyInstance,
  service: NotificationService,
  guard: Guard,
): void {
  app.get('/me/events', { preHandler: guard, exposeHeadRoute: false }, async (request, reply) => {
    if (request.headers['sec-fetch-site'] === 'cross-site') {
      throw new AppError({
        status: 403,
        code: 'forbidden',
        title: 'Forbidden',
        detail: 'SSE доступен только с того же сайта.',
      });
    }

    const { userId } = actorOf(request);
    request.raw.setTimeout(0);
    return openEventStream(request, reply, userId, service);
  });
}

export const notificationsRoutes: FastifyPluginAsync<NotificationRoutesOptions> = async (
  app,
  options,
) => {
  const hub = createNotificationHub();
  const service = createNotificationService({
    db: options.db,
    config: options.config,
    logger: options.logger,
    events: options.events,
    hub,
    ...(options.push ? { push: options.push } : {}),
    ...(options.telegram ? { telegram: options.telegram } : {}),
  });
  const guard = createAuthGuard({ db: options.db, config: options.config });

  app.addHook('preClose', async () => {
    service.close();
  });

  app.addHook('onClose', async () => {
    service.close();
  });

  registerListRoutes(app, service, guard);
  registerPushRoutes(app, service, guard);
  registerEventStream(app, service, guard);
};
