import type { BookingDetail, BookingListQuery, BookingsResponse } from '@staynest/shared';
import type { BookingRuntime } from './context';
import { decodeBookingCursor, encodeBookingCursor } from './cursor';
import { bookingNotFound } from './errors';
import { toBookingDetail, toBookingSummary } from './mapping';
import { findBookingForActor, listBookingEvents, listBookingsForUser } from './repo';

export async function listBookings(
  runtime: BookingRuntime,
  userId: string,
  query: BookingListQuery,
): Promise<BookingsResponse> {
  const cursor = query.cursor ? decodeBookingCursor(query.cursor) : null;
  const rows = await listBookingsForUser(runtime.db.kysely, userId, query, cursor);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page.at(-1);

  return {
    bookings: page.map((row) => toBookingSummary(row, runtime.config.storage.publicPath)),
    nextCursor:
      hasMore && last
        ? encodeBookingCursor({ v: 1, createdAt: last.created_at_precise, id: last.id })
        : null,
  };
}

export async function getBooking(
  runtime: BookingRuntime,
  userId: string,
  bookingId: string,
): Promise<BookingDetail> {
  return runtime.db.kysely
    .transaction()
    .setIsolationLevel('repeatable read')
    .execute(async (trx) => {
      const row = await findBookingForActor(trx, bookingId, userId);
      if (!row) throw bookingNotFound();

      const events = await listBookingEvents(trx, bookingId);
      return toBookingDetail(row, events, runtime.config.storage.publicPath);
    });
}
