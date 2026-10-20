import type { BookingResponse, CreateBookingInput, Quote } from '@staynest/shared';
import { quoteForBooking, quoteRejected } from '../pricing/index';
import type { QuoteFailure } from '../pricing/index';
import { lockBookableListing } from '../listings/index';
import type { DbExecutor } from '../../platform/db/index';
import type { BookingEventPayload } from '../../platform/events/index';
import { AppError } from '../../platform/http/errors';
import { todayOf, enforceBookingRateLimit } from './context';
import type { BookingRuntime } from './context';
import { expireStaleForListing } from './expiry';
import {
  bookingDatesUnavailable,
  bookingOwnListing,
  bookingRequiresVerifiedEmail,
  idempotencyKeyConflict,
  mapBookingInsertError,
  tooManyPendingBookings,
} from './errors';
import { toBookingDetail } from './mapping';
import {
  BOOKING_ENDPOINT,
  bookingRequestHash,
  findIdempotency,
  lockIdempotencyKey,
  saveIdempotentResponse,
} from './idempotency';
import type { IdempotencyRow } from './idempotency';
import {
  countPendingForGuest,
  findBookingById,
  insertBooking,
  insertBookingEvent,
  listBookingEvents,
  lockGuest,
} from './repo';

export type CreateBookingResult =
  | { replayed: true; status: number; body: BookingResponse }
  | {
      replayed: false;
      status: 201;
      body: BookingResponse;
      event: BookingEventPayload;
      expiredEvents: BookingEventPayload[];
    };

function unauthorized(): AppError {
  return new AppError({
    status: 401,
    code: 'unauthorized',
    title: 'Unauthorized',
    detail: 'Требуется авторизация.',
  });
}

function replayOrConflict(existing: IdempotencyRow, requestHash: string): CreateBookingResult {
  if (
    existing.endpoint !== BOOKING_ENDPOINT ||
    existing.request_hash !== requestHash ||
    existing.response_status === null ||
    existing.response_body === null
  ) {
    throw idempotencyKeyConflict();
  }

  return {
    replayed: true,
    status: existing.response_status,
    body: existing.response_body as unknown as BookingResponse,
  };
}

function quoteFailure(failure: QuoteFailure): AppError {
  if (failure.code === 'dates_unavailable') return bookingDatesUnavailable();
  return quoteRejected(failure);
}

function ensureGuestCanBook(
  runtime: BookingRuntime,
  guest: { is_active: boolean; email_verified_at: Date | null } | undefined,
): void {
  if (!guest || !guest.is_active) throw unauthorized();
  if (runtime.config.auth.requireEmailVerification && guest.email_verified_at === null) {
    throw bookingRequiresVerifiedEmail();
  }
}

type CreateContext = {
  runtime: BookingRuntime;
  guestId: string;
  input: CreateBookingInput;
  key: string;
  requestHash: string;
  now: Date;
  today: string;
  expiresAt: Date;
};

async function insertPendingBooking(
  trx: DbExecutor,
  context: CreateContext,
  quote: Quote,
): Promise<{ id: string }> {
  try {
    return await insertBooking(trx, {
      listingId: context.input.listingId,
      guestId: context.guestId,
      checkIn: context.input.checkIn,
      checkOut: context.input.checkOut,
      guestsCount: context.input.guestsCount,
      totalMinor: quote.totalMinor,
      currency: quote.currency,
      priceBreakdown: quote,
      guestMessage: context.input.guestMessage ?? null,
      expiresAt: context.expiresAt,
    });
  } catch (error) {
    const conflict = mapBookingInsertError(error);
    if (conflict) throw conflict;
    throw error;
  }
}

async function createdResponse(
  trx: DbExecutor,
  bookingId: string,
  guestId: string,
  publicPath: string,
): Promise<BookingResponse> {
  const row = await findBookingById(trx, bookingId);
  if (!row) throw new Error('Созданная бронь не найдена');

  return {
    booking: toBookingDetail(row, await listBookingEvents(trx, bookingId), {
      publicPath,
      viewerId: guestId,
    }),
  };
}

async function createInTransaction(
  trx: DbExecutor,
  context: CreateContext,
): Promise<CreateBookingResult> {
  const { runtime, guestId, input, key, requestHash } = context;

  await lockIdempotencyKey(trx, guestId, key);
  const existing = await findIdempotency(trx, guestId, key);
  if (existing) return replayOrConflict(existing, requestHash);

  enforceBookingRateLimit(runtime, guestId);
  const guest = await lockGuest(trx, guestId);
  ensureGuestCanBook(runtime, guest);

  const pending = await countPendingForGuest(trx, guestId);
  if (pending >= runtime.maxActivePending) throw tooManyPendingBookings(runtime.maxActivePending);

  const listing = await lockBookableListing(trx, input.listingId);
  if (listing.ownerId === guestId) throw bookingOwnListing();

  // Даты освобождаются до quote: истёкшая pending всё ещё блокирует диапазон
  // через exclusion constraint, даже если worker отстаёт.
  const expiredEvents = await expireStaleForListing(trx, listing.id, context.now);

  const quote = await quoteForBooking(trx, {
    listing,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.guestsCount,
    today: context.today,
  });
  if (!quote.ok) throw quoteFailure(quote);

  const inserted = await insertPendingBooking(trx, context, quote.quote);
  await insertBookingEvent(trx, {
    bookingId: inserted.id,
    actorId: guestId,
    fromStatus: null,
    toStatus: 'pending',
    note: null,
  });

  const body = await createdResponse(trx, inserted.id, guestId, runtime.config.storage.publicPath);
  await saveIdempotentResponse(trx, { userId: guestId, key, requestHash, status: 201, body });

  return {
    replayed: false as const,
    status: 201 as const,
    body,
    event: {
      bookingId: inserted.id,
      listingId: input.listingId,
      guestId,
      hostId: listing.ownerId,
      status: 'pending' as const,
      occurredAt: context.now.toISOString(),
      listingTitle: listing.title,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestName: guest?.display_name ?? '',
      totalMinor: quote.quote.totalMinor,
      currency: quote.quote.currency,
      expiresAt: context.expiresAt.toISOString(),
    },
    expiredEvents,
  };
}

export async function createBooking(
  runtime: BookingRuntime,
  guestId: string,
  input: CreateBookingInput,
  idempotencyKey: string,
): Promise<CreateBookingResult> {
  const now = runtime.now();
  const context: CreateContext = {
    runtime,
    guestId,
    input,
    key: idempotencyKey,
    requestHash: bookingRequestHash(input),
    now,
    today: todayOf(runtime),
    expiresAt: new Date(now.getTime() + runtime.requestTtlHours * 3_600_000),
  };

  const result = await runtime.db.kysely
    .transaction()
    .execute((trx) => createInTransaction(trx, context));

  if (!result.replayed) {
    for (const expired of result.expiredEvents) {
      runtime.events.publish('booking.expired', expired);
    }
    runtime.events.publish('booking.requested', result.event);
  }
  return result;
}
