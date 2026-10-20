import { z } from 'zod';
import { isoDateSchema } from './pricing';

export const NOTIFICATION_LIST_LIMIT_MAX = 50;
export const NOTIFICATION_MARK_READ_MAX = 100;

export const notificationTypeSchema = z.enum([
  'booking_requested',
  'booking_confirmed',
  'booking_declined',
  'booking_cancelled',
  'booking_expired',
  'booking_deposit_expired',
  'booking_expiring_soon',
  'booking_completed',
]);

/**
 * Семантическое содержимое уведомления: клиент переводит тип и поля сам,
 * поэтому в БД не хранятся готовые тексты на одном языке.
 */
export const notificationPayloadSchema = z
  .object({
    bookingId: z.uuid(),
    listingId: z.uuid(),
    listingTitle: z.string(),
    checkIn: isoDateSchema,
    checkOut: isoDateSchema,
    guestName: z.string(),
    totalMinor: z.number().int().nonnegative(),
    currency: z.string(),
    actorRole: z.enum(['guest', 'host']).optional(),
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();

export const notificationDtoSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  payload: notificationPayloadSchema,
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const notificationListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(NOTIFICATION_LIST_LIMIT_MAX).default(20),
    cursor: z.string().max(512).optional(),
  })
  .strict();

export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationDtoSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
});

export const markNotificationsReadInputSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(NOTIFICATION_MARK_READ_MAX).optional(),
  })
  .strict();

export const markNotificationsReadResponseSchema = z.object({
  updated: z.number().int().nonnegative(),
  unreadCount: z.number().int().nonnegative(),
});

const base64UrlKeySchema = z
  .string()
  .min(8)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+={0,2}$/, 'Ожидается base64url-ключ.');

const pushEndpointSchema = z
  .url()
  .max(2048)
  .refine((value) => value.startsWith('https://'), 'Push endpoint должен быть https.');

export const pushSubscriptionInputSchema = z
  .object({
    endpoint: pushEndpointSchema,
    keys: z
      .object({
        p256dh: base64UrlKeySchema,
        auth: base64UrlKeySchema,
      })
      .strict(),
    userAgent: z.string().trim().max(500).optional(),
  })
  .strict();

export const deletePushSubscriptionInputSchema = z
  .object({
    endpoint: pushEndpointSchema,
  })
  .strict();

export const pushConfigResponseSchema = z.object({
  enabled: z.boolean(),
  publicKey: z.string().nullable(),
});

export const pushSubscriptionDtoSchema = z.object({
  id: z.uuid(),
  endpoint: z.string(),
  createdAt: z.iso.datetime(),
});

export const pushSubscriptionResponseSchema = z.object({
  subscription: pushSubscriptionDtoSchema,
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
export type NotificationDto = z.infer<typeof notificationDtoSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadInputSchema>;
export type MarkNotificationsReadResponse = z.infer<typeof markNotificationsReadResponseSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;
export type DeletePushSubscriptionInput = z.infer<typeof deletePushSubscriptionInputSchema>;
export type PushConfigResponse = z.infer<typeof pushConfigResponseSchema>;
export type PushSubscriptionDto = z.infer<typeof pushSubscriptionDtoSchema>;
export type PushSubscriptionResponse = z.infer<typeof pushSubscriptionResponseSchema>;
