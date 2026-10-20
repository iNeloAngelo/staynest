import { z } from 'zod';
import { nightsBetween } from './dates';
import { MAX_QUOTE_NIGHTS, bookingStatusSchema, isoDateSchema, quoteSchema } from './pricing';

export const BOOKING_MESSAGE_MAX = 1000;
export const BOOKING_REASON_MAX = 500;
export const BOOKING_IDEMPOTENCY_KEY_MAX = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function alias(source: Record<string, unknown>, target: string, ...candidates: string[]): void {
  if (source[target] !== undefined) return;
  const found = candidates.find((candidate) => source[candidate] !== undefined);
  if (found) source[target] = source[found];
}

/**
 * ТЗ и внешние клиенты используют snake_case, web — camelCase.
 * Принимаем оба варианта, наружу отдаём только camelCase.
 */
function withBookingAliases(input: unknown): unknown {
  if (!isRecord(input)) return input;

  const source = { ...input };
  alias(source, 'listingId', 'listing_id');
  alias(source, 'checkIn', 'check_in');
  alias(source, 'checkOut', 'check_out');
  alias(source, 'guestsCount', 'guests_count', 'guests');
  alias(source, 'guestMessage', 'guest_message', 'message');

  for (const key of [
    'listing_id',
    'check_in',
    'check_out',
    'guests_count',
    'guests',
    'guest_message',
    'message',
  ]) {
    delete source[key];
  }

  return source;
}

const optionalMessage = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max, `Текст не длиннее ${max} символов.`).optional(),
  );

export const createBookingInputSchema = z.preprocess(
  withBookingAliases,
  z
    .object({
      listingId: z.uuid('Укажите объявление.'),
      checkIn: isoDateSchema,
      checkOut: isoDateSchema,
      guestsCount: z.coerce.number().int().min(1).max(30),
      guestMessage: optionalMessage(BOOKING_MESSAGE_MAX),
    })
    .strict()
    .refine((value) => value.checkOut > value.checkIn, {
      path: ['checkOut'],
      message: 'Дата выезда должна быть позже даты заезда.',
    })
    .refine(
      (value) =>
        value.checkOut <= value.checkIn ||
        nightsBetween(value.checkIn, value.checkOut) <= MAX_QUOTE_NIGHTS,
      {
        path: ['checkOut'],
        message: `Максимальный срок — ${MAX_QUOTE_NIGHTS} ночей.`,
      },
    ),
);

export const bookingRoleSchema = z.enum(['guest', 'host']);

export const bookingListQuerySchema = z
  .object({
    role: bookingRoleSchema.default('guest'),
    status: bookingStatusSchema.optional(),
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const declineBookingInputSchema = z
  .object({
    comment: optionalMessage(BOOKING_MESSAGE_MAX),
  })
  .strict();

export const cancelBookingInputSchema = z
  .object({
    reason: optionalMessage(BOOKING_REASON_MAX),
  })
  .strict();

export const bookingListingSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  city: z.string().nullable(),
  coverPhotoUrl: z.string().nullable(),
});

export const bookingGuestSummarySchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
});

export const bookingSummarySchema = z.object({
  id: z.uuid(),
  listingId: z.uuid(),
  guestId: z.uuid(),
  status: bookingStatusSchema,
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  nights: z.number().int(),
  guestsCount: z.number().int(),
  totalMinor: z.number().int(),
  currency: z.string(),
  priceBreakdown: quoteSchema,
  guestMessage: z.string().nullable(),
  hostResponse: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  cancelledByRole: z.enum(['guest', 'host']).nullable(),
  cancelReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  listing: bookingListingSummarySchema,
  guest: bookingGuestSummarySchema,
});

export const bookingEventSchema = z.object({
  id: z.string(),
  actorRole: z.enum(['guest', 'host', 'system']),
  fromStatus: bookingStatusSchema.nullable(),
  toStatus: bookingStatusSchema,
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const bookingContactsSchema = z.object({
  /** Точный адрес дома: виден участникам только после подтверждения. */
  addressLine: z.string().nullable(),
  /** Телефон второй стороны: гостю — хозяина, хозяину — гостя. */
  hostPhone: z.string().nullable(),
  guestPhone: z.string().nullable(),
});

export const bookingDetailSchema = bookingSummarySchema.extend({
  events: z.array(bookingEventSchema),
  contacts: bookingContactsSchema.nullable(),
});

export const bookingResponseSchema = z.object({ booking: bookingDetailSchema });
export const bookingsResponseSchema = z.object({
  bookings: z.array(bookingSummarySchema),
  nextCursor: z.string().nullable(),
});

export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
export type BookingRole = z.infer<typeof bookingRoleSchema>;
export type BookingListQuery = z.infer<typeof bookingListQuerySchema>;
export type DeclineBookingInput = z.infer<typeof declineBookingInputSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;
export type BookingListingSummary = z.infer<typeof bookingListingSummarySchema>;
export type BookingGuestSummary = z.infer<typeof bookingGuestSummarySchema>;
export type BookingSummary = z.infer<typeof bookingSummarySchema>;
export type BookingEvent = z.infer<typeof bookingEventSchema>;
export type BookingContacts = z.infer<typeof bookingContactsSchema>;
export type BookingDetail = z.infer<typeof bookingDetailSchema>;
export type BookingResponse = z.infer<typeof bookingResponseSchema>;
export type BookingsResponse = z.infer<typeof bookingsResponseSchema>;
