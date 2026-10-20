import type { FavoritesResponse } from '@staynest/shared';
import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addFavoriteRequest,
  fetchFavoriteIds,
  fetchFavorites,
  removeFavoriteRequest,
} from './favorites';

const FAVORITES_STALE_TIME_MS = 60_000;

const favoriteKeys = {
  ids: ['favorites', 'ids'] as const,
  list: ['favorites', 'list'] as const,
};

function withoutListing(
  data: InfiniteData<FavoritesResponse>,
  listingId: string,
): InfiniteData<FavoritesResponse> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      listings: page.listings.filter((listing) => listing.id !== listingId),
    })),
  };
}

/** Идентификаторы избранного для сердечек: один запрос на всё приложение. */
export function useFavoriteIds(enabled = true) {
  return useQuery<string[]>({
    queryKey: favoriteKeys.ids,
    queryFn: fetchFavoriteIds,
    enabled,
    staleTime: FAVORITES_STALE_TIME_MS,
  });
}

export function useFavorites() {
  return useInfiniteQuery<FavoritesResponse>({
    queryKey: favoriteKeys.list,
    queryFn: ({ pageParam }) => fetchFavorites(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: FAVORITES_STALE_TIME_MS,
  });
}

type ToggleInput = { listingId: string; favorite: boolean };
type ToggleContext = {
  previous: string[] | undefined;
  previousLists: Array<[QueryKey, InfiniteData<FavoritesResponse> | undefined]>;
};

/**
 * Оптимистичное сердечко: состояние меняется сразу, при ошибке откатывается.
 * Один кэш id обслуживает и карточки каталога, и страницу объявления —
 * поэтому сердце синхронизируется между экранами без ручной синхронизации.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, ToggleInput, ToggleContext>({
    mutationFn: ({ listingId, favorite }) =>
      favorite ? addFavoriteRequest(listingId) : removeFavoriteRequest(listingId),

    async onMutate({ listingId, favorite }) {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.ids });
      const previous = queryClient.getQueryData<string[]>(favoriteKeys.ids);
      const previousLists = queryClient.getQueriesData<InfiniteData<FavoritesResponse>>({
        queryKey: favoriteKeys.list,
      });

      queryClient.setQueryData<string[]>(favoriteKeys.ids, (current = []) => {
        if (favorite) return current.includes(listingId) ? current : [listingId, ...current];
        return current.filter((id) => id !== listingId);
      });

      if (!favorite) {
        queryClient.setQueriesData<InfiniteData<FavoritesResponse>>(
          { queryKey: favoriteKeys.list },
          (current) => (current ? withoutListing(current, listingId) : current),
        );
      }

      return { previous, previousLists };
    },

    onError(_error, _variables, context) {
      if (!context) return;
      queryClient.setQueryData(favoriteKeys.ids, context.previous);
      for (const [key, data] of context.previousLists) queryClient.setQueryData(key, data);
    },

    onSettled() {
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.ids });
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.list });
    },
  });
}
