import type { CatalogSort, ListingType } from '@staynest/shared';

export const CATALOG_PAGE_SIZE = 24;

export const LISTING_TYPES: ListingType[] = ['house', 'cottage', 'cabin', 'villa', 'townhouse'];
const CATALOG_SORTS: CatalogSort[] = ['newest', 'price_asc', 'price_desc', 'relevance'];

export type CatalogFilters = {
  q: string;
  city: string;
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

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const q = (params.get('q') ?? '').trim();
  const city = (params.get('city') ?? '').trim();
  const sort = params.get('sort');

  return {
    q: q.slice(0, 120),
    city: city.slice(0, 120),
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

  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.city.trim()) params.set('city', filters.city.trim());
  if (filters.guests !== null) params.set('guests', String(filters.guests));
  if (filters.priceMin !== null) params.set('priceMin', String(filters.priceMin));
  if (filters.priceMax !== null) params.set('priceMax', String(filters.priceMax));
  if (filters.bedroomsMin !== null) params.set('bedroomsMin', String(filters.bedroomsMin));
  if (filters.types.length > 0) params.set('type', filters.types.join(','));
  if (filters.amenities.length > 0) params.set('amenities', filters.amenities.join(','));
  if (filters.sort) params.set('sort', filters.sort);

  return params;
}

export function effectiveSort(filters: CatalogFilters): CatalogSort {
  if (filters.sort === 'relevance' && !filters.q.trim()) return 'newest';
  return filters.sort ?? (filters.q.trim() ? 'relevance' : 'newest');
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.city.trim() !== '' ||
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
