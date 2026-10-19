import type { ListingStatus } from '@staynest/shared';
import type { DbExecutor } from '../../platform/db/index';
import { listingNotFound } from './errors';
import { findOwnedListing, lockOwnedListing, lockPublishedListing } from './repo';

export type OwnedListingRef = {
  id: string;
  status: ListingStatus;
  coverPhotoId: string | null;
  maxNights: number;
};

export type BookableListingRef = {
  id: string;
  ownerId: string;
  title: string;
  city: string | null;
  coverPhotoId: string | null;
  maxGuests: number;
  basePriceMinor: number;
  weekendPriceMinor: number | null;
  cleaningFeeMinor: number;
  minNights: number;
  maxNights: number;
  currency: string;
};

function required<T>(value: T | null, field: string): T {
  if (value === null) throw new Error(`published listing has empty ${field}`);
  return value;
}

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

  return {
    id: row.id,
    status: row.status,
    coverPhotoId: row.cover_photo_id,
    maxNights: row.max_nights,
  };
}

/**
 * Объявление, которое можно бронировать: только `published`, строка
 * блокируется на время транзакции (`FOR UPDATE`). Порядок блокировок
 * совпадает с `availability` и `listings` (listings → bookings).
 */
export async function lockBookableListing(
  executor: DbExecutor,
  listingId: string,
): Promise<BookableListingRef> {
  const row = await lockPublishedListing(executor, listingId);
  if (!row) throw listingNotFound();

  return {
    id: row.id,
    ownerId: row.owner_id,
    title: required(row.title, 'title'),
    city: row.city,
    coverPhotoId: row.cover_photo_id,
    maxGuests: required(row.max_guests, 'max_guests'),
    basePriceMinor: required(
      row.base_price_minor === null ? null : Number(row.base_price_minor),
      'base_price_minor',
    ),
    weekendPriceMinor: row.weekend_price_minor === null ? null : Number(row.weekend_price_minor),
    cleaningFeeMinor: Number(row.cleaning_fee_minor),
    minNights: row.min_nights,
    maxNights: row.max_nights,
    currency: row.currency.trim(),
  };
}
