import { sql } from 'kysely';
import type { Selectable, Updateable } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';
import type { Amenities, Listings, ListingType } from '../../platform/db/schema.generated';

export type ListingRow = Selectable<Listings>;
export type AmenityRow = Selectable<Amenities>;

export type ListingPatch = Updateable<Listings>;

type PendingCountRow = { listing_id: string; count: string };

export function findOwnedListing(
  executor: DbExecutor,
  ownerId: string,
  id: string,
): Promise<ListingRow | undefined> {
  return executor
    .selectFrom('listings')
    .selectAll()
    .where('id', '=', id)
    .where('owner_id', '=', ownerId)
    .executeTakeFirst();
}

/** Блокирует строку на время транзакции: статус и брони не меняются под нами. */
export function lockOwnedListing(
  executor: DbExecutor,
  ownerId: string,
  id: string,
): Promise<ListingRow | undefined> {
  return executor
    .selectFrom('listings')
    .selectAll()
    .where('id', '=', id)
    .where('owner_id', '=', ownerId)
    .forUpdate()
    .executeTakeFirst();
}

export function listOwnedListings(executor: DbExecutor, ownerId: string): Promise<ListingRow[]> {
  return executor
    .selectFrom('listings')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .orderBy('updated_at', 'desc')
    .orderBy('id', 'desc')
    .execute();
}

export function insertDraft(
  executor: DbExecutor,
  ownerId: string,
  type: ListingType | undefined,
): Promise<ListingRow> {
  return executor
    .insertInto('listings')
    .values({ owner_id: ownerId, ...(type ? { type } : {}) })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function updateListing(
  executor: DbExecutor,
  id: string,
  patch: ListingPatch,
): Promise<ListingRow> {
  return executor
    .updateTable('listings')
    .set(patch)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function publishListing(executor: DbExecutor, id: string, at: Date): Promise<ListingRow> {
  return executor
    .updateTable('listings')
    .set({ status: 'published', published_at: at })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function archiveListing(executor: DbExecutor, id: string): Promise<ListingRow> {
  return executor
    .updateTable('listings')
    .set({ status: 'archived' })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteListing(executor: DbExecutor, id: string): Promise<void> {
  await executor.deleteFrom('listings').where('id', '=', id).execute();
}

export function listAmenities(executor: DbExecutor): Promise<AmenityRow[]> {
  return executor
    .selectFrom('amenities')
    .selectAll()
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .execute();
}

export async function existingAmenityIds(executor: DbExecutor, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];

  const rows = await executor.selectFrom('amenities').select('id').where('id', 'in', ids).execute();

  return rows.map((row) => row.id);
}

export function listListingAmenities(
  executor: DbExecutor,
  listingId: string,
): Promise<AmenityRow[]> {
  return executor
    .selectFrom('listing_amenities')
    .innerJoin('amenities', 'amenities.id', 'listing_amenities.amenity_id')
    .selectAll('amenities')
    .where('listing_amenities.listing_id', '=', listingId)
    .orderBy('amenities.sort_order', 'asc')
    .orderBy('amenities.id', 'asc')
    .execute();
}

export type ListingAmenityRow = AmenityRow & { listing_id: string };

export function listAmenitiesForListings(
  executor: DbExecutor,
  listingIds: string[],
): Promise<ListingAmenityRow[]> {
  if (listingIds.length === 0) return Promise.resolve([]);

  return executor
    .selectFrom('listing_amenities')
    .innerJoin('amenities', 'amenities.id', 'listing_amenities.amenity_id')
    .selectAll('amenities')
    .select('listing_amenities.listing_id')
    .where('listing_amenities.listing_id', 'in', listingIds)
    .orderBy('amenities.sort_order', 'asc')
    .orderBy('amenities.id', 'asc')
    .execute();
}

export async function replaceAmenities(
  executor: DbExecutor,
  listingId: string,
  amenityIds: number[],
): Promise<void> {
  await executor.deleteFrom('listing_amenities').where('listing_id', '=', listingId).execute();

  if (amenityIds.length === 0) return;

  await executor
    .insertInto('listing_amenities')
    .values(amenityIds.map((amenityId) => ({ listing_id: listingId, amenity_id: amenityId })))
    .execute();
}

export async function countPhotos(executor: DbExecutor, listingId: string): Promise<number> {
  const row = await executor
    .selectFrom('listing_photos')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('listing_id', '=', listingId)
    .executeTakeFirstOrThrow();

  return Number(row.count);
}

/** Read-only взгляд в таблицу броней: сколько заявок ждут ответа хозяина. */
export async function countPendingBookings(
  executor: DbExecutor,
  listingIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (listingIds.length === 0) return result;

  const rows = (await executor
    .selectFrom('bookings')
    .select(['listing_id', ({ fn }) => fn.countAll<string>().as('count')])
    .where('listing_id', 'in', listingIds)
    .where('status', '=', 'pending')
    .groupBy('listing_id')
    .execute()) as PendingCountRow[];

  for (const row of rows) result.set(row.listing_id, Number(row.count));
  return result;
}

/** Будущие активные брони запрещают архивирование (FR-L6). */
export function hasActiveFutureBookings(
  executor: DbExecutor,
  listingId: string,
): Promise<{ id: string } | undefined> {
  return executor
    .selectFrom('bookings')
    .select('id')
    .where('listing_id', '=', listingId)
    .where('status', 'in', ['pending', 'confirmed'])
    .where('check_out', '>=', sql<string>`current_date`)
    .executeTakeFirst();
}
