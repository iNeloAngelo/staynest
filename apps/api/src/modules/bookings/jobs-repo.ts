import type { Selectable } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';
import type { Bookings } from '../../platform/db/schema.generated';

export type JobBookingRow = Selectable<Bookings> & {
  listing_owner_id: string;
  listing_title: string;
  guest_display_name: string;
};

/** Истёкшие заявки конкретного объявления: вызывается под его FOR UPDATE. */
export function lockExpiredPendingForListing(
  executor: DbExecutor,
  listingId: string,
  now: Date,
): Promise<JobBookingRow[]> {
  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .innerJoin('users', 'users.id', 'bookings.guest_id')
    .selectAll('bookings')
    .select('listings.owner_id as listing_owner_id')
    .select('listings.title as listing_title')
    .select('users.display_name as guest_display_name')
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
    .innerJoin('users', 'users.id', 'bookings.guest_id')
    .selectAll('bookings')
    .select('listings.owner_id as listing_owner_id')
    .select('listings.title as listing_title')
    .select('users.display_name as guest_display_name')
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
    .innerJoin('users', 'users.id', 'bookings.guest_id')
    .selectAll('bookings')
    .select('listings.owner_id as listing_owner_id')
    .select('listings.title as listing_title')
    .select('users.display_name as guest_display_name')
    .where('bookings.status', '=', 'confirmed')
    .where('bookings.check_out', '<', today)
    .orderBy('bookings.check_out', 'asc')
    .limit(limit)
    .forUpdate('bookings')
    .skipLocked()
    .execute() as Promise<JobBookingRow[]>;
}

/**
 * Заявки, которые истекут в ближайшие часы. Ничего не блокирует и не меняет:
 * событие превращается в напоминание хозяину, дедупликацию делает notifications.
 */
export function listPendingExpiring(
  executor: DbExecutor,
  from: Date,
  to: Date,
  limit: number,
): Promise<JobBookingRow[]> {
  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .innerJoin('users', 'users.id', 'bookings.guest_id')
    .selectAll('bookings')
    .select('listings.owner_id as listing_owner_id')
    .select('listings.title as listing_title')
    .select('users.display_name as guest_display_name')
    .where('bookings.status', '=', 'pending')
    .where('bookings.expires_at', 'is not', null)
    .where('bookings.expires_at', '>', from)
    .where('bookings.expires_at', '<=', to)
    .orderBy('bookings.expires_at', 'asc')
    .limit(limit)
    .execute() as Promise<JobBookingRow[]>;
}
