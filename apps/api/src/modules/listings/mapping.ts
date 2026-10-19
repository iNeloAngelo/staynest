import type { UpdateListingInput } from '@staynest/shared';
import type { ListingPatch } from './repo';

type PatchColumn = keyof ListingPatch;

/** Единственное место, где имена API-полей превращаются в имена столбцов. */
const FIELD_MAP = {
  title: 'title',
  description: 'description',
  type: 'type',
  country: 'country',
  region: 'region',
  city: 'city',
  addressLine: 'address_line',
  lat: 'lat',
  lng: 'lng',
  maxGuests: 'max_guests',
  bedrooms: 'bedrooms',
  beds: 'beds',
  bathrooms: 'bathrooms',
  areaSqm: 'area_sqm',
  basePriceMinor: 'base_price_minor',
  weekendPriceMinor: 'weekend_price_minor',
  cleaningFeeMinor: 'cleaning_fee_minor',
  currency: 'currency',
  minNights: 'min_nights',
  maxNights: 'max_nights',
  checkInTime: 'check_in_time',
  checkOutTime: 'check_out_time',
  houseRules: 'house_rules',
} satisfies Record<keyof UpdateListingInput, PatchColumn>;

export function toListingPatch(input: UpdateListingInput): ListingPatch {
  const patch: Record<string, unknown> = {};

  for (const [apiField, column] of Object.entries(FIELD_MAP)) {
    const value = input[apiField as keyof typeof FIELD_MAP];
    if (value !== undefined) patch[column] = value;
  }

  return patch as ListingPatch;
}
