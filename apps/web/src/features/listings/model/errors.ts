import type { ListingPublishIssue } from '@staynest/shared';
import { ApiError } from '../../../shared/api';
import type { TranslationKey } from '../../../shared/i18n';

const ERROR_KEYS: Record<string, TranslationKey> = {
  listing_not_found: 'listings.errors.not_found',
  listing_not_draft: 'listings.errors.not_draft',
  listing_not_published: 'listings.errors.not_published',
  listing_already_published: 'listings.errors.already_published',
  listing_has_active_bookings: 'listings.errors.active_bookings',
  listing_incomplete: 'listings.errors.incomplete',
  email_not_verified: 'listings.errors.email_not_verified',
  validation_error: 'listings.errors.validation',
  network_error: 'listings.errors.network',
  unauthorized: 'listings.errors.unauthorized',
  internal_error: 'listings.errors.server',
};

const ISSUE_KEYS: Record<string, TranslationKey> = {
  title_required: 'listings.issues.title_required',
  title_too_short: 'listings.issues.title_too_short',
  title_too_long: 'listings.issues.title_too_long',
  description_too_short: 'listings.issues.description_too_short',
  city_required: 'listings.issues.city_required',
  address_required: 'listings.issues.address_required',
  max_guests_required: 'listings.issues.max_guests_required',
  bedrooms_required: 'listings.issues.bedrooms_required',
  beds_required: 'listings.issues.beds_required',
  base_price_required: 'listings.issues.base_price_required',
  photos_too_few: 'listings.issues.photos_too_few',
  invalid_max_guests: 'listings.issues.invalid_max_guests',
  invalid_bedrooms: 'listings.issues.invalid_bedrooms',
  invalid_beds: 'listings.issues.invalid_beds',
  invalid_bathrooms: 'listings.issues.invalid_bathrooms',
  invalid_area: 'listings.issues.invalid_area',
  invalid_price: 'listings.issues.invalid_price',
  invalid_nights: 'listings.issues.invalid_nights',
  invalid_range: 'listings.issues.invalid_range',
  invalid_time: 'listings.issues.invalid_time',
};

export function listingsErrorKey(error: unknown): TranslationKey {
  if (error instanceof ApiError) return ERROR_KEYS[error.code] ?? 'listings.errors.generic';
  return 'listings.errors.generic';
}

export function issueTextKey(code: string): TranslationKey {
  return ISSUE_KEYS[code] ?? 'listings.issues.generic';
}

export function publishIssuesFrom(error: unknown): ListingPublishIssue[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.errors)) return [];

  return error.errors.filter(
    (item): item is ListingPublishIssue =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { field?: unknown }).field === 'string' &&
      typeof (item as { code?: unknown }).code === 'string',
  );
}

const ANCHORED_FIELDS = new Set([
  'title',
  'description',
  'city',
  'addressLine',
  'maxGuests',
  'bedrooms',
  'beds',
  'basePrice',
]);

const FIELD_ALIASES: Record<string, string> = {
  basePriceMinor: 'basePrice',
};

export function fieldAnchor(field: string): string | null {
  const normalized = FIELD_ALIASES[field] ?? field;
  return ANCHORED_FIELDS.has(normalized) ? `listing-${normalized}` : null;
}
