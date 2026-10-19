import type { Selectable } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';
import type { ListingPhotos } from '../../platform/db/schema.generated';

export type PhotoRow = Selectable<ListingPhotos>;

export type NewPhoto = {
  id: string;
  listing_id: string;
  storage_prefix: string;
  width: number;
  height: number;
  blurhash: string | null;
  position: number;
  is_cover: boolean;
};

export function listPhotos(executor: DbExecutor, listingId: string): Promise<PhotoRow[]> {
  return executor
    .selectFrom('listing_photos')
    .selectAll()
    .where('listing_id', '=', listingId)
    .orderBy('position', 'asc')
    .orderBy('created_at', 'asc')
    .execute();
}

export function findPhoto(
  executor: DbExecutor,
  listingId: string,
  photoId: string,
): Promise<PhotoRow | undefined> {
  return executor
    .selectFrom('listing_photos')
    .selectAll()
    .where('listing_id', '=', listingId)
    .where('id', '=', photoId)
    .executeTakeFirst();
}

export async function countPhotos(executor: DbExecutor, listingId: string): Promise<number> {
  const row = await executor
    .selectFrom('listing_photos')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('listing_id', '=', listingId)
    .executeTakeFirstOrThrow();

  return Number(row.count);
}

export async function nextPosition(executor: DbExecutor, listingId: string): Promise<number> {
  const row = await executor
    .selectFrom('listing_photos')
    .select(({ fn }) => fn.max<number | null>('position').as('max'))
    .where('listing_id', '=', listingId)
    .executeTakeFirstOrThrow();

  return row.max === null ? 0 : Number(row.max) + 1;
}

export async function hasCover(executor: DbExecutor, listingId: string): Promise<boolean> {
  const row = await executor
    .selectFrom('listing_photos')
    .select('id')
    .where('listing_id', '=', listingId)
    .where('is_cover', '=', true)
    .executeTakeFirst();

  return Boolean(row);
}

export async function insertPhotos(executor: DbExecutor, photos: NewPhoto[]): Promise<void> {
  if (photos.length === 0) return;
  await executor.insertInto('listing_photos').values(photos).execute();
}

export async function updatePositions(
  executor: DbExecutor,
  listingId: string,
  photoIds: string[],
): Promise<void> {
  for (const [position, id] of photoIds.entries()) {
    await executor
      .updateTable('listing_photos')
      .set({ position })
      .where('id', '=', id)
      .where('listing_id', '=', listingId)
      .execute();
  }
}

export async function clearCover(executor: DbExecutor, listingId: string): Promise<void> {
  await executor
    .updateTable('listing_photos')
    .set({ is_cover: false })
    .where('listing_id', '=', listingId)
    .where('is_cover', '=', true)
    .execute();
}

export async function markCover(
  executor: DbExecutor,
  listingId: string,
  photoId: string,
): Promise<void> {
  await executor
    .updateTable('listing_photos')
    .set({ is_cover: true })
    .where('listing_id', '=', listingId)
    .where('id', '=', photoId)
    .execute();
}

export async function setListingCover(
  executor: DbExecutor,
  listingId: string,
  photoId: string | null,
): Promise<void> {
  await executor
    .updateTable('listings')
    .set({ cover_photo_id: photoId })
    .where('id', '=', listingId)
    .execute();
}

export async function deletePhoto(executor: DbExecutor, photoId: string): Promise<void> {
  await executor.deleteFrom('listing_photos').where('id', '=', photoId).execute();
}

/** Первое по порядку фото — новая обложка, если прежнюю удалили. */
export function firstPhoto(
  executor: DbExecutor,
  listingId: string,
): Promise<{ id: string } | undefined> {
  return executor
    .selectFrom('listing_photos')
    .select('id')
    .where('listing_id', '=', listingId)
    .orderBy('position', 'asc')
    .orderBy('created_at', 'asc')
    .limit(1)
    .executeTakeFirst();
}
