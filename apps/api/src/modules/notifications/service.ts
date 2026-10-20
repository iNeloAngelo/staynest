import type {
  MarkNotificationsReadInput,
  MarkNotificationsReadResponse,
  NotificationListQuery,
  NotificationsResponse,
  PushConfigResponse,
  PushSubscriptionInput,
  PushSubscriptionResponse,
} from '@staynest/shared';
import type { Logger } from 'pino';
import { createNotificationHub, MAX_STREAMS_PER_USER } from './hub';
import type { NotificationHub, NotificationStreamClient } from './hub';
import { subscribeBookingEvents } from './delivery';
import type { NotificationRuntime } from './delivery';
import { toNotificationDto } from './mapping';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { EventBus } from '../../platform/events/index';
import { FixedWindowRateLimiter } from '../../platform/http/rate-limit';
import type { RateLimitRule } from '../../platform/http/rate-limit';
import { decodeNotificationCursor, encodeNotificationCursor } from './cursor';
import {
  pushHostNotAllowed,
  pushNotConfigured,
  pushRateLimited,
  tooManyEventStreams,
} from './errors';
import { createPushSender, isAllowedPushHost } from './push';
import type { PushSender } from './push';
import {
  countUnread,
  deletePushSubscription,
  listNotifications,
  markRead,
  upsertPushSubscription,
} from './repo';

const PUSH_RATE_LIMIT: RateLimitRule = { max: 20, windowMs: 3_600_000 };

export type NotificationServiceDependencies = {
  db: Db;
  config: AppConfig;
  logger: Logger;
  events: EventBus;
  hub?: NotificationHub;
  push?: PushSender;
  now?: () => Date;
};

export type NotificationService = {
  list(userId: string, query: NotificationListQuery): Promise<NotificationsResponse>;
  markRead(
    userId: string,
    input: MarkNotificationsReadInput,
  ): Promise<MarkNotificationsReadResponse>;
  pushConfig(): PushConfigResponse;
  addPushSubscription(
    userId: string,
    input: PushSubscriptionInput,
  ): Promise<PushSubscriptionResponse>;
  removePushSubscription(userId: string, endpoint: string): Promise<void>;
  openStream(userId: string, client: NotificationStreamClient): () => void;
  streamCount(userId: string): number;
  close(): void;
};

async function listFor(
  runtime: NotificationRuntime,
  userId: string,
  query: NotificationListQuery,
): Promise<NotificationsResponse> {
  const cursor = query.cursor ? decodeNotificationCursor(query.cursor) : null;
  const rows = await listNotifications(runtime.db.kysely, userId, query.limit, cursor);
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);

  return {
    notifications: page.map(toNotificationDto),
    unreadCount: await countUnread(runtime.db.kysely, userId),
    nextCursor:
      rows.length > query.limit && last
        ? encodeNotificationCursor({
            v: 1,
            createdAt: last.created_at_precise,
            id: last.id,
          })
        : null,
  };
}

async function addPushFor(
  runtime: NotificationRuntime,
  userId: string,
  input: PushSubscriptionInput,
): Promise<PushSubscriptionResponse> {
  if (!runtime.push.enabled) throw pushNotConfigured();
  if (!isAllowedPushHost(input.endpoint)) throw pushHostNotAllowed();

  const decision = runtime.limiter.check(`push:${userId}`, PUSH_RATE_LIMIT);
  if (!decision.allowed) throw pushRateLimited(decision.retryAfterSeconds);

  const row = await upsertPushSubscription(runtime.db.kysely, userId, {
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent: input.userAgent ?? null,
  });

  return {
    subscription: {
      id: row.id,
      endpoint: row.endpoint,
      createdAt: row.created_at.toISOString(),
    },
  };
}

function openStream(
  runtime: NotificationRuntime,
  userId: string,
  client: NotificationStreamClient,
): () => void {
  if (!runtime.hub.subscribe(userId, client)) {
    throw tooManyEventStreams(MAX_STREAMS_PER_USER);
  }

  return () => {
    runtime.hub.unsubscribe(userId, client);
  };
}

export function createNotificationService({
  db,
  config,
  logger,
  events,
  hub = createNotificationHub(),
  push = createPushSender(config.push, logger),
  now = () => new Date(),
}: NotificationServiceDependencies): NotificationService {
  const runtime: NotificationRuntime = {
    db,
    config,
    logger,
    events,
    hub,
    push,
    now,
    limiter: new FixedWindowRateLimiter(() => now().getTime()),
  };
  const unsubscribe = subscribeBookingEvents(runtime);

  return {
    list: (userId, query) => listFor(runtime, userId, query),
    async markRead(userId, input) {
      const updated = await markRead(db.kysely, userId, now(), input.ids);
      return { updated, unreadCount: await countUnread(db.kysely, userId) };
    },
    pushConfig: () => ({ enabled: push.enabled, publicKey: push.publicKey }),
    addPushSubscription: (userId, input) => addPushFor(runtime, userId, input),
    removePushSubscription: (userId, endpoint) =>
      deletePushSubscription(db.kysely, userId, endpoint),
    openStream: (userId, client) => openStream(runtime, userId, client),
    streamCount: (userId) => hub.count(userId),
    close() {
      unsubscribe();
      hub.closeAll();
    },
  };
}
