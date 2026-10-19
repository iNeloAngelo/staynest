import type {
  CitySuggestionsResponse,
  PublicListingResponse,
  PublicListingsResponse,
} from '@staynest/shared';
import { api } from '../../../shared/api';
import type { CatalogFilters } from '../model/filters';
import { CATALOG_PAGE_SIZE, effectiveSort } from '../model/filters';

function searchParams(filters: CatalogFilters, cursor: string | null): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.city.trim()) params.set('city', filters.city.trim());
  if (filters.checkIn && filters.checkOut) {
    params.set('check_in', filters.checkIn);
    params.set('check_out', filters.checkOut);
  }
  if (filters.guests !== null) params.set('guests', String(filters.guests));
  if (filters.priceMin !== null) params.set('priceMin', String(filters.priceMin));
  if (filters.priceMax !== null) params.set('priceMax', String(filters.priceMax));
  if (filters.bedroomsMin !== null) params.set('bedroomsMin', String(filters.bedroomsMin));
  if (filters.types.length > 0) params.set('type', filters.types.join(','));
  if (filters.amenities.length > 0) params.set('amenities', filters.amenities.join(','));

  params.set('sort', effectiveSort(filters));
  params.set('limit', String(CATALOG_PAGE_SIZE));
  if (cursor) params.set('cursor', cursor);

  return params;
}

export async function fetchCatalog(
  filters: CatalogFilters,
  cursor: string | null = null,
): Promise<PublicListingsResponse> {
  return api.get<PublicListingsResponse>(`/listings?${searchParams(filters, cursor).toString()}`);
}

export async function fetchListing(id: string): Promise<PublicListingResponse['listing']> {
  const response = await api.get<PublicListingResponse>(`/listings/${id}`);
  return response.listing;
}

export async function fetchCitySuggestions(query: string): Promise<string[]> {
  const params = new URLSearchParams({ q: query.trim(), limit: '8' });
  const response = await api.get<CitySuggestionsResponse>(`/cities?${params.toString()}`);
  return response.cities;
}
