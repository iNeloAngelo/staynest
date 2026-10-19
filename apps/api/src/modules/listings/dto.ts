import type { AmenityDto, ListingDto } from '@staynest/shared';
import type { AmenityRow, ListingRow } from './repo';

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function toAmenityDto(row: AmenityRow): AmenityDto {
  return {
    id: row.id,
    code: row.code,
    nameRu: row.name_ru,
    nameEn: row.name_en,
    icon: row.icon,
    sortOrder: row.sort_order,
  };
}

export function toListingDto(
  row: ListingRow,
  amenities: AmenityRow[],
  pendingBookingsCount: number,
): ListingDto {
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    title: row.title,
    description: row.description,
    country: row.country,
    region: row.region,
    city: row.city,
    addressLine: row.address_line,
    lat: numberOrNull(row.lat),
    lng: numberOrNull(row.lng),
    maxGuests: row.max_guests,
    bedrooms: row.bedrooms,
    beds: row.beds,
    bathrooms: row.bathrooms,
    areaSqm: row.area_sqm,
    basePriceMinor: numberOrNull(row.base_price_minor),
    weekendPriceMinor: numberOrNull(row.weekend_price_minor),
    cleaningFeeMinor: Number(row.cleaning_fee_minor),
    currency: row.currency.trim(),
    minNights: row.min_nights,
    maxNights: row.max_nights,
    checkInTime: row.check_in_time.slice(0, 5),
    checkOutTime: row.check_out_time.slice(0, 5),
    houseRules: row.house_rules,
    coverPhotoId: row.cover_photo_id,
    amenities: amenities.map(toAmenityDto),
    pendingBookingsCount,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}
