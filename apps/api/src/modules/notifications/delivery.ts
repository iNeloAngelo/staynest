import type { Locale, NotificationPayload, NotificationType } from '@staynest/shared';
import type { Logger } from 'pino';
import { toNotificationDto } from './mapping';
import type { NotificationHub } from './hub';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { EventBus } from '../../platform/events/index';
import type { BookingEventPayload } from '../../platform/events/index';
import type { FixedWindowRateLimiter } from '../../platform/http/rate-limit';
import { usersService } from '../users/index';
import { findTelegramChatId } from '../telegram/index';
import type { TelegramSender } from '../telegram/index';
import type { PushSender } from './push';
import {
  deletePushSubscriptionById,
  insertNotification,
  listPushSubscriptions,
  touchPushSubscription,
} from './repo';
import { pushMessage } from './texts';

const PUSH_ENABLED_TYPES: ReadonlySet<NotificationType> = new Set([
  'booking_requested',
  'booking_confirmed',
  'booking_declined',
  'booking_cancelled',
  'booking_expiring_soon',
  'booking_deposit_expired',
]);

/** В Telegram не дублируем «поездка завершена» и истечение: это шум в чате. */
const TELEGRAM_ENABLED_TYPES: ReadonlySet<NotificationType> = new Set([
  'booking_requested',
  'booking_confirmed',
  'booking_declined',
  'booking_cancelled',
  'booking_expiring_soon',
  'booking_deposit_expired',
]);

export type NotificationRuntime = {
  db: Db;
  config: AppConfig;
  logger: Logger;
  events: EventBus;
  hub: NotificationHub;
  push: PushSender;
  telegram: TelegramSender;
  now: () => Date;
  limiter: FixedWindowRateLimiter;
};

function notificationPayload(
  event: BookingEventPayload,
  actorRole?: 'guest' | 'host',
): NotificationPayload {
  return {
    bookingId: event.bookingId,
    listingId: event.listingId,
    listingTitle: event.listingTitle,
    checkIn: event.checkIn,
    checkOut: event.checkOut,
    guestName: event.guestName,
    totalMinor: event.totalMinor,
    currency: event.currency,
    ...(actorRole ? { actorRole } : {}),
    ...(event.expiresAt ? { expiresAt: event.expiresAt } : {}),
  };
}

function recipientOf(event: BookingEventPayload, role: 'guest' | 'host'): string {
  return role === 'guest' ? event.guestId : event.hostId;
}

async function sendPush(
  runtime: NotificationRuntime,
  input: {
    userId: string;
    locale: Locale;
    type: NotificationType;
    payload: NotificationPayload;
  },
): Promise<void> {
  const { userId, locale, type, payload } = input;
  if (!runtime.push.enabled || !PUSH_ENABLED_TYPES.has(type)) return;

  const subscriptions = await listPushSubscriptions(runtime.db.kysely, userId);
  if (subscriptions.length === 0) return;

  const message = pushMessage(type, payload, locale, runtime.config.listingTimeZone);

  for (const subscription of subscriptions) {
    const result = await runtime.push.send(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
      message,
    );

    if (result.ok) {
      await touchPushSubscription(runtime.db.kysely, subscription.id, runtime.now());
    } else if (result.gone) {
      // Браузер отозвал подписку (404/410): строка больше не нужна.
      await deletePushSubscriptionById(runtime.db.kysely, subscription.id);
    } else {
      runtime.logger.error({ code: result.code }, 'web push failed');
    }
  }
}

async function sendTelegram(
  runtime: NotificationRuntime,
  input: {
    userId: string;
    locale: Locale;
    type: NotificationType;
    payload: NotificationPayload;
  },
): Promise<void> {
  const { userId, locale, type, payload } = input;
  if (!runtime.telegram.enabled || !TELEGRAM_ENABLED_TYPES.has(type)) return;

  const chatId = await findTelegramChatId(runtime.db.kysely, userId);
  if (!chatId) return;

  const message = pushMessage(type, payload, locale, runtime.config.listingTimeZone);
  const result = await runtime.telegram.send(chatId, {
    title: message.title,
    body: message.body,
    url: `${runtime.config.webAppUrl}${message.url}`,
  });

  if (!result.ok) runtime.logger.warn({ code: result.code }, 'telegram notification failed');
}

async function createFor(
  runtime: NotificationRuntime,
  input: {
    userId: string;
    type: NotificationType;
    payload: NotificationPayload;
    dedupeKey?: string;
  },
): Promise<void> {
  const { userId, type, payload, dedupeKey } = input;
  const user = await usersService.findById(runtime.db.kysely, userId);
  if (!user || user.deleted_at !== null) return;

  const row = await insertNotification(runtime.db.kysely, {
    userId,
    type,
    payload,
    ...(dedupeKey ? { dedupeKey } : {}),
  });
  if (!row) return;

  runtime.hub.publish(userId, toNotificationDto(row));
  const locale = user.locale === 'en' ? 'en' : 'ru';
  await sendPush(runtime, {
    userId,
    locale,
    type,
    payload,
  });
  await sendTelegram(runtime, {
    userId,
    locale,
    type,
    payload,
  });
}

async function onBookingEvent(
  runtime: NotificationRuntime,
  type: NotificationType,
  event: BookingEventPayload,
  role: 'guest' | 'host',
): Promise<void> {
  await createFor(runtime, {
    userId: recipientOf(event, role),
    type,
    payload: notificationPayload(event),
  });
}

async function onCancelled(
  runtime: NotificationRuntime,
  event: BookingEventPayload & { actorId: string },
): Promise<void> {
  const actorRole = event.actorId === event.guestId ? 'guest' : 'host';
  const recipientRole = actorRole === 'guest' ? 'host' : 'guest';

  await createFor(runtime, {
    userId: recipientOf(event, recipientRole),
    type: 'booking_cancelled',
    payload: notificationPayload(event, actorRole),
  });
}

async function onExpiringSoon(
  runtime: NotificationRuntime,
  event: BookingEventPayload,
): Promise<void> {
  await createFor(runtime, {
    userId: event.hostId,
    type: 'booking_expiring_soon',
    payload: notificationPayload(event),
    dedupeKey: `expiring:${event.bookingId}`,
  });
}

async function onDepositExpired(
  runtime: NotificationRuntime,
  event: BookingEventPayload,
): Promise<void> {
  for (const role of ['guest', 'host'] as const) {
    await createFor(runtime, {
      userId: recipientOf(event, role),
      type: 'booking_deposit_expired',
      payload: notificationPayload(event),
    });
  }
}

export function subscribeBookingEvents(runtime: NotificationRuntime): () => void {
  const events = runtime.events;
  const unsubscribers = [
    events.subscribe('booking.requested', (event) =>
      onBookingEvent(runtime, 'booking_requested', event, 'host'),
    ),
    events.subscribe('booking.confirmed', (event) =>
      onBookingEvent(runtime, 'booking_confirmed', event, 'guest'),
    ),
    events.subscribe('booking.declined', (event) =>
      onBookingEvent(runtime, 'booking_declined', event, 'guest'),
    ),
    events.subscribe('booking.cancelled', (event) => onCancelled(runtime, event)),
    events.subscribe('booking.expired', (event) =>
      onBookingEvent(runtime, 'booking_expired', event, 'guest'),
    ),
    events.subscribe('booking.deposit_expired', (event) => onDepositExpired(runtime, event)),
    events.subscribe('booking.completed', (event) =>
      onBookingEvent(runtime, 'booking_completed', event, 'guest'),
    ),
    events.subscribe('booking.expiring_soon', (event) => onExpiringSoon(runtime, event)),
  ];

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
