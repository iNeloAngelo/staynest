import { sql } from 'kysely';
import type { Selectable, Updateable } from 'kysely';
import type { BookingListQuery, BookingStatus, Quote } from '@staynest/shared';
import type { DbExecutor } from '../../platform/db/index';
import type { Bookings, Json } from '../../platform/db/schema.generated';
import type { BookingCursor } from './cursor';

export type BookingRow = Selectable<Bookings>;

export type BookingDetailRow = BookingRow & {
  listing_owner_id: string;
  listing_title: string;
  listing_city: string | null;
  cover_storage_prefix: string | null;
  guest_display_name: string;
  created_at_precise: string;
};

export type GuestRow = {
  id: string;
  is_active: boolean;
  email_verified_at: Date | null;
};

export type JobBookingRow = BookingRow & { listing_owner_id: string };

function createdAtPrecise() {
  return sql<string>`to_char(bookings.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

function detailSelection() {
  return [
    'listings.owner_id as listing_owner_id',
    'listings.title as listing_title',
    'listings.city as listing_city',
    'listing_photos.storage_prefix as cover_storage_prefix',
    'users.display_name as guest_display_name',
    createdAtPrecise().as('created_at_precise'),
  ] as const;
}

function detailQuery(executor: DbExecutor) {
  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .innerJoin('users', 'users.id', 'bookings.guest_id')
    .leftJoin('listing_photos', 'listing_photos.id', 'listings.cover_photo_id');
}

/** Блокирует строку гостя: лимит pending и смена пароля не разъезжаются. */
export function lockGuest(executor: DbExecutor, userId: string): Promise<GuestRow | undefined> {
  return executor
    .selectFrom('users')
    .select(['id', 'is_active', 'email_verified_at'])
    .where('id', '=', userId)
    .forUpdate()
    .executeTakeFirst();
}

export async function countPendingForGuest(executor: DbExecutor, guestId: string): Promise<number> {
  const row = await executor
    .selectFrom('bookings')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('guest_id', '=', guestId)
    .where('status', '=', 'pending')
    .where(sql<boolean>`(expires_at IS NULL OR expires_at > now())`)
    .executeTakeFirstOrThrow();

  return Number(row.count);
}

export function insertBooking(
  executor: DbExecutor,
  input: {
    listingId: string;
    guestId: string;
    checkIn: string;
    checkOut: string;
    guestsCount: number;
    totalMinor: number;
    currency: string;
    priceBreakdown: Quote;
    guestMessage: string | null;
    expiresAt: Date;
  },
): Promise<BookingRow> {
  return executor
    .insertInto('bookings')
    .values({
      listing_id: input.listingId,
      guest_id: input.guestId,
      stay_range: sql<string>`daterange(${input.checkIn}::date, ${input.checkOut}::date, '[)')`,
      guests_count: input.guestsCount,
      status: 'pending',
      total_minor: input.totalMinor,
      currency: input.currency,
      price_breakdown: input.priceBreakdown as unknown as Json,
      guest_message: input.guestMessage,
      expires_at: input.expiresAt,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function findBookingById(
  executor: DbExecutor,
  bookingId: string,
): Promise<BookingDetailRow | undefined> {
  return detailQuery(executor)
    .selectAll('bookings')
    .select(detailSelection())
    .where('bookings.id', '=', bookingId)
    .executeTakeFirst() as Promise<BookingDetailRow | undefined>;
}

function actorCondition(executor: DbExecutor, userId: string) {
  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .innerJoin('users', 'users.id', 'bookings.guest_id')
    .leftJoin('listing_photos', 'listing_photos.id', 'listings.cover_photo_id')
    .where((eb) =>
      eb.or([eb('bookings.guest_id', '=', userId), eb('listings.owner_id', '=', userId)]),
    );
}

export function findBookingForActor(
  executor: DbExecutor,
  bookingId: string,
  userId: string,
): Promise<BookingDetailRow | undefined> {
  return actorCondition(executor, userId)
    .selectAll('bookings')
    .select(detailSelection())
    .where('bookings.id', '=', bookingId)
    .executeTakeFirst() as Promise<BookingDetailRow | undefined>;
}

/** Блокировка брони для смены статуса; чужая бронь неотличима от отсутствующей. */
export function lockBookingForActor(
  executor: DbExecutor,
  bookingId: string,
  userId: string,
): Promise<BookingDetailRow | undefined> {
  return actorCondition(executor, userId)
    .selectAll('bookings')
    .select(detailSelection())
    .where('bookings.id', '=', bookingId)
    .forUpdate('bookings')
    .executeTakeFirst() as Promise<BookingDetailRow | undefined>;
}

export async function listBookingsForUser(
  executor: DbExecutor,
  userId: string,
  query: BookingListQuery,
  cursor: BookingCursor | null,
): Promise<BookingDetailRow[]> {
  let builder = detailQuery(executor)
    .selectAll('bookings')
    .select(detailSelection())
    .where(query.role === 'guest' ? 'bookings.guest_id' : 'listings.owner_id', '=', userId);

  if (query.status) builder = builder.where('bookings.status', '=', query.status);
  if (cursor) {
    builder = builder.where(
      sql<boolean>`(bookings.created_at, bookings.id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`,
    );
  }

  const rows = await builder
    .orderBy('bookings.created_at', 'desc')
    .orderBy('bookings.id', 'desc')
    .limit(query.limit + 1)
    .execute();

  return rows as BookingDetailRow[];
}

export function updateBookingStatus(
  executor: DbExecutor,
  bookingId: string,
  status: BookingStatus,
  patch: Updateable<Bookings>,
): Promise<BookingRow> {
  return executor
    .updateTable('bookings')
    .set({ status, ...patch })
    .where('id', '=', bookingId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function insertBookingEvent(
  executor: DbExecutor,
  input: {
    bookingId: string;
    actorId: string | null;
    fromStatus: BookingStatus | null;
    toStatus: BookingStatus;
    note: string | null;
  },
): Promise<void> {
  return executor
    .insertInto('booking_events')
    .values({
      booking_id: input.bookingId,
      actor_id: input.actorId,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      note: input.note,
    })
    .executeTakeFirst()
    .then(() => undefined);
}

export type BookingEventRow = {
  id: string;
  actor_id: string | null;
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  note: string | null;
  created_at: Date;
};

export function listBookingEvents(
  executor: DbExecutor,
  bookingId: string,
): Promise<BookingEventRow[]> {
  return executor
    .selectFrom('booking_events')
    .select(['id', 'actor_id', 'from_status', 'to_status', 'note', 'created_at'])
    .where('booking_id', '=', bookingId)
    .orderBy('id', 'asc')
    .execute() as Promise<BookingEventRow[]>;
}

/** Истёкшие заявки конкретного объявления: вызывается под его FOR UPDATE. */
export function lockExpiredPendingForListing(
  executor: DbExecutor,
  listingId: string,
  now: Date,
): Promise<JobBookingRow[]> {
  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .selectAll('bookings')
    .select('listings.owner_id as listing_owner_id')
    .where('bookings.listing_id', '=', listingId)
    .where('bookings.status', '=', 'pending')
    .where('bookings.expires_at', 'is not', null)
    .where('bookings.expires_at', '<=', now)
    .orderBy('bookings.expires_at', 'asc')
    .limit(100)
    .forUpdate('bookings')
    .execute() as Promise<JobBookingRow[]>;
}

/** Истёкшие заявки: строки блокируются, параллельный confirm их пропустит. */
export function lockExpiredPending(
  executor: DbExecutor,
  now: Date,
  limit: number,
): Promise<JobBookingRow[]> {
  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .selectAll('bookings')
    .select('listings.owner_id as listing_owner_id')
    .where('bookings.status', '=', 'pending')
    .where('bookings.expires_at', 'is not', null)
    .where('bookings.expires_at', '<=', now)
    .orderBy('bookings.expires_at', 'asc')
    .limit(limit)
    .forUpdate('bookings')
    .skipLocked()
    .execute() as Promise<JobBookingRow[]>;
}

/** Подтверждённые брони, у которых дата выезда уже прошла. */
export function lockConfirmedToComplete(
  executor: DbExecutor,
  today: string,
  limit: number,
): Promise<JobBookingRow[]> {
  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .selectAll('bookings')
    .select('listings.owner_id as listing_owner_id')
    .where('bookings.status', '=', 'confirmed')
    .where('bookings.check_out', '<', today)
    .orderBy('bookings.check_out', 'asc')
    .limit(limit)
    .forUpdate('bookings')
    .skipLocked()
    .execute() as Promise<JobBookingRow[]>;
}
