import type {
  AmenityDto,
  ListingPhotoDto,
  PublicListing,
  PublicListingSummary,
} from '@staynest/shared';
import { variantKey } from '../../platform/storage/index';
import type { MediaStorage } from '../../platform/storage/index';
import type { CatalogAmenityRow, CatalogPhotoRow, CatalogRow } from './repo';

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function required<T>(value: T | null, field: string): T {
  if (value === null) throw new Error(`published listing has empty ${field}`);
  return value;
}

/** Округление до 0.01° (~1 км): точное место скрыто до подтверждения брони. */
function approximate(value: string | null): number | null {
  if (value === null) return null;
  return Math.round(Number(value) * 100) / 100;
}

function toPhotoDto(row: CatalogPhotoRow, storage: MediaStorage): ListingPhotoDto {
  return {
    id: row.id,
    width: row.width,
    height: row.height,
    blurhash: row.blurhash,
    position: row.position,
    isCover: row.is_cover,
    urls: {
      thumb: storage.publicUrl(variantKey(row.storage_prefix, 'thumb')),
      md: storage.publicUrl(variantKey(row.storage_prefix, 'md')),
      lg: storage.publicUrl(variantKey(row.storage_prefix, 'lg')),
    },
  };
}

function toAmenityDto(row: CatalogAmenityRow): AmenityDto {
  return {
    id: row.id,
    code: row.code,
    nameRu: row.name_ru,
    nameEn: row.name_en,
    icon: row.icon,
    sortOrder: row.sort_order,
  };
}

function toPhotoList(rows: CatalogPhotoRow[], storage: MediaStorage): ListingPhotoDto[] {
  return rows.map((row) => toPhotoDto(row, storage));
}

export function toPublicSummary(
  row: CatalogRow,
  photos: CatalogPhotoRow[],
  storage: MediaStorage,
): PublicListingSummary {
  const cover = photos.find((photo) => photo.is_cover) ?? photos[0];

  return {
    id: row.id,
    type: row.type,
    title: required(row.title, 'title'),
    country: row.country,
    region: row.region,
    city: required(row.city, 'city'),
    approxLat: approximate(row.lat),
    approxLng: approximate(row.lng),
    maxGuests: required(row.max_guests, 'max_guests'),
    bedrooms: required(row.bedrooms, 'bedrooms'),
    beds: required(row.beds, 'beds'),
    bathrooms: row.bathrooms,
    areaSqm: row.area_sqm,
    basePriceMinor: required(numberOrNull(row.base_price_minor), 'base_price_minor'),
    weekendPriceMinor: numberOrNull(row.weekend_price_minor),
    cleaningFeeMinor: Number(row.cleaning_fee_minor),
    currency: row.currency.trim(),
    minNights: row.min_nights,
    maxNights: row.max_nights,
    coverPhoto: cover ? toPhotoDto(cover, storage) : null,
    photoCount: photos.length,
    publishedAt: required(row.published_at, 'published_at').toISOString(),
  };
}

export function toPublicListing(
  row: CatalogRow,
  photos: CatalogPhotoRow[],
  amenities: CatalogAmenityRow[],
  storage: MediaStorage,
): PublicListing {
  return {
    ...toPublicSummary(row, photos, storage),
    description: row.description,
    checkInTime: row.check_in_time.slice(0, 5),
    checkOutTime: row.check_out_time.slice(0, 5),
    houseRules: row.house_rules,
    photos: toPhotoList(photos, storage),
    amenities: amenities.map(toAmenityDto),
  };
}
