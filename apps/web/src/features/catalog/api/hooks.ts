import type { PublicListing } from '@staynest/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchCatalog, fetchCitySuggestions, fetchListing } from './catalog';
import type { CatalogFilters } from '../model/filters';

const catalogKeys = {
  list: (filters: CatalogFilters) => ['catalog', 'list', filters] as const,
  detail: (id: string) => ['catalog', 'detail', id] as const,
  cities: (query: string) => ['catalog', 'cities', query] as const,
};

const CATALOG_STALE_TIME_MS = 60_000;
const CITY_STALE_TIME_MS = 10 * 60 * 1000;

export function useCatalog(filters: CatalogFilters) {
  return useInfiniteQuery({
    queryKey: catalogKeys.list(filters),
    queryFn: ({ pageParam }) => fetchCatalog(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: CATALOG_STALE_TIME_MS,
  });
}

export function useListing(id: string | undefined) {
  return useQuery<PublicListing>({
    queryKey: catalogKeys.detail(id ?? ''),
    queryFn: () => fetchListing(id ?? ''),
    enabled: Boolean(id),
    staleTime: CATALOG_STALE_TIME_MS,
  });
}

export function useCitySuggestions(query: string) {
  const trimmed = query.trim();

  return useQuery<string[]>({
    queryKey: catalogKeys.cities(trimmed),
    queryFn: () => fetchCitySuggestions(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: CITY_STALE_TIME_MS,
  });
}
