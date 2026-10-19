import type { BookingEventPayload } from '../../platform/events/index';
import type { DbExecutor } from '../../platform/db/index';
import { insertBookingEvent, lockExpiredPendingForListing, updateBookingStatus } from './repo';

/**
 * Освобождает даты перед новой бронью, если worker отстал: pending с
 * истёкшим expires_at переводится в expired под блокировкой объявления.
 * Возвращает события для публикации после коммита.
 */
export async function expireStaleForListing(
  executor: DbExecutor,
  listingId: string,
  now: Date,
): Promise<BookingEventPayload[]> {
  const payloads: BookingEventPayload[] = [];

  for (let batch = 0; batch < 5; batch += 1) {
    const rows = await lockExpiredPendingForListing(executor, listingId, now);
    if (rows.length === 0) break;

    for (const row of rows) {
      await updateBookingStatus(executor, row.id, 'expired', {});
      await insertBookingEvent(executor, {
        bookingId: row.id,
        actorId: null,
        fromStatus: 'pending',
        toStatus: 'expired',
        note: 'expires_at',
      });
      payloads.push({
        bookingId: row.id,
        listingId: row.listing_id,
        guestId: row.guest_id,
        hostId: row.listing_owner_id,
        status: 'expired',
        occurredAt: now.toISOString(),
      });
    }

    if (rows.length < 100) break;
  }

  return payloads;
}
