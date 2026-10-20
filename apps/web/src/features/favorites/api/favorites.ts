import type { FavoritesResponse } from '@staynest/shared';
import { api } from '../../../shared/api';

const FAVORITES_PAGE_SIZE = 12;

export async function fetchFavorites(cursor: string | null = null): Promise<FavoritesResponse> {
  const params = new URLSearchParams({ limit: String(FAVORITES_PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  return api.get<FavoritesResponse>(`/me/favorites?${params.toString()}`);
}

export async function fetchFavoriteIds(): Promise<string[]> {
  const response = await api.get<{ listingIds: string[] }>('/me/favorites/ids');
  return response.listingIds;
}

export async function addFavoriteRequest(listingId: string): Promise<void> {
  await api.put(`/me/favorites/${listingId}`);
}

export async function removeFavoriteRequest(listingId: string): Promise<void> {
  await api.delete(`/me/favorites/${listingId}`);
}
