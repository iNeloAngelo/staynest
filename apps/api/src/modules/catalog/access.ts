import type { DbExecutor } from '../../platform/db/index';
import { catalogListingNotFound } from './errors';
import { findPublishedListing } from './repo';

export type PublicListingRef = {
  id: string;
  ownerId: string;
  title: string;
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
 * Минимальные данные опубликованного объявления для календаря и расчёта цены.
 * Черновик и архив снаружи неотличимы от несуществующего объявления.
 */
export async function requirePublishedListing(
  executor: DbExecutor,
  id: string,
): Promise<PublicListingRef> {
  const row = await findPublishedListing(executor, id);
  if (!row) throw catalogListingNotFound();

  return {
    id: row.id,
    ownerId: row.owner_id,
    title: required(row.title, 'title'),
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
