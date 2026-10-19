import type { CatalogSort, ListingType } from '@staynest/shared';
import { isIsoDate, MAX_QUOTE_NIGHTS, nightsBetween } from '@staynest/shared';

export const CATALOG_PAGE_SIZE = 24;

export const LISTING_TYPES: ListingType[] = ['house', 'cottage', 'cabin', 'villa', 'townhouse'];
const CATALOG_SORTS: CatalogSort[] = ['newest', 'price_asc', 'price_desc', 'relevance'];

export type CatalogFilters = {
  q: string;
  city: string;
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
  priceMin: number | null;
  priceMax: number | null;
  bedroomsMin: number | null;
  types: ListingType[];
  amenities: number[];
  sort: CatalogSort | null;
};

export const EMPTY_FILTERS: CatalogFilters = {
  q: '',
  city: '',
  checkIn: null,
  checkOut: null,
  guests: null,
  priceMin: null,
  priceMax: null,
  bedroomsMin: null,
  types: [],
  amenities: [],
  sort: null,
};

function integerInRange(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function isListingType(value: string): value is ListingType {
  return LISTING_TYPES.includes(value as ListingType);
}

function isSort(value: string): value is CatalogSort {
  return CATALOG_SORTS.includes(value as CatalogSort);
}

function list(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isoDateOrNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && isIsoDate(trimmed) ? trimmed : null;
}

/** Неполный, перевёрнутый или слишком длинный диапазон отбрасывается целиком. */
function stayRange(params: URLSearchParams): { checkIn: string | null; checkOut: string | null } {
  const checkIn = isoDateOrNull(params.get('checkIn'));
  const checkOut = isoDateOrNull(params.get('checkOut'));

  if (!checkIn || !checkOut || checkOut <= checkIn) return { checkIn: null, checkOut: null };
  if (nightsBetween(checkIn, checkOut) > MAX_QUOTE_NIGHTS) {
    return { checkIn: null, checkOut: null };
  }

  return { checkIn, checkOut };
}

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const q = (params.get('q') ?? '').trim();
  const city = (params.get('city') ?? '').trim();
  const sort = params.get('sort');
  const range = stayRange(params);

  return {
    q: q.slice(0, 120),
    city: city.slice(0, 120),
    checkIn: range.checkIn,
    checkOut: range.checkOut,
    guests: integerInRange(params.get('guests'), 1, 30),
    priceMin: integerInRange(params.get('priceMin'), 0, 100_000_000_000),
    priceMax: integerInRange(params.get('priceMax'), 0, 100_000_000_000),
    bedroomsMin: integerInRange(params.get('bedroomsMin'), 0, 20),
    types: [...new Set(list(params, 'type').filter(isListingType))],
    amenities: [
      ...new Set(
        list(params, 'amenities')
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0 && value <= 32_767),
      ),
    ],
    sort: sort && isSort(sort) ? sort : null,
  };
}

/** Фильтры в URL: только непустые значения, стабильный порядок параметров. */
export function filtersToSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();

  setTextParam(params, 'q', filters.q);
  setTextParam(params, 'city', filters.city);

  if (filters.checkIn && filters.checkOut && filters.checkOut > filters.checkIn) {
    params.set('checkIn', filters.checkIn);
    params.set('checkOut', filters.checkOut);
  }

  setNumberParam(params, 'guests', filters.guests);
  setNumberParam(params, 'priceMin', filters.priceMin);
  setNumberParam(params, 'priceMax', filters.priceMax);
  setNumberParam(params, 'bedroomsMin', filters.bedroomsMin);
  if (filters.types.length > 0) params.set('type', filters.types.join(','));
  if (filters.amenities.length > 0) params.set('amenities', filters.amenities.join(','));
  if (filters.sort) params.set('sort', filters.sort);

  return params;
}

function setTextParam(params: URLSearchParams, key: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed) params.set(key, trimmed);
}

function setNumberParam(params: URLSearchParams, key: string, value: number | null): void {
  if (value !== null) params.set(key, String(value));
}

export function effectiveSort(filters: CatalogFilters): CatalogSort {
  if (filters.sort === 'relevance' && !filters.q.trim()) return 'newest';
  return filters.sort ?? (filters.q.trim() ? 'relevance' : 'newest');
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.city.trim() !== '' ||
    (filters.checkIn !== null && filters.checkOut !== null) ||
    filters.guests !== null ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.bedroomsMin !== null ||
    filters.types.length > 0 ||
    filters.amenities.length > 0
  );
}

export function toggleItem<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((entry) => entry !== item) : [...items, item];
}
