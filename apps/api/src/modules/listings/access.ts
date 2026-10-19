import type { ListingStatus } from '@staynest/shared';
import type { DbExecutor } from '../../platform/db/index';
import { listingNotFound } from './errors';
import { findOwnedListing, lockOwnedListing } from './repo';

export type OwnedListingRef = {
  id: string;
  status: ListingStatus;
  coverPhotoId: string | null;
};

/**
 * Публичный доступ других модулей к объявлению: только минимальные поля и
 * проверка владения. Чужое объявление неотличимо от несуществующего.
 */
export async function requireOwnedListing(
  executor: DbExecutor,
  ownerId: string,
  listingId: string,
  options: { lock?: boolean } = {},
): Promise<OwnedListingRef> {
  const row = options.lock
    ? await lockOwnedListing(executor, ownerId, listingId)
    : await findOwnedListing(executor, ownerId, listingId);

  if (!row) throw listingNotFound();

  return { id: row.id, status: row.status, coverPhotoId: row.cover_photo_id };
}
