import type { FavoritesQuery, FavoritesResponse } from '@staynest/shared';
import type { Db } from '../../platform/db/index';
import type { MediaStorage } from '../../platform/storage/index';
import { createCatalogService, requirePublishedListing } from '../catalog/index';
import type { CatalogService } from '../catalog/index';
import { decodeFavoritesCursor, encodeFavoritesCursor } from './cursor';
import { invalidFavoritesCursor } from './errors';
import { addFavorite, listFavoriteIds, listFavorites, removeFavorite } from './repo';

export type FavoritesServiceDependencies = {
  db: Db;
  storage: MediaStorage;
  catalog?: Pick<CatalogService, 'summariesByIds'>;
};

export function createFavoritesService({ db, storage, catalog }: FavoritesServiceDependencies) {
  const cards = catalog ?? createCatalogService({ db, storage });

  return {
    async list(userId: string, query: FavoritesQuery): Promise<FavoritesResponse> {
      const cursor = query.cursor ? decodeFavoritesCursor(query.cursor) : null;
      if (query.cursor && !cursor) throw invalidFavoritesCursor();

      const rows = await listFavorites(db.kysely, userId, cursor, query.limit);
      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page.at(-1);

      const listings = await cards.summariesByIds(page.map((row) => row.listing_id));

      return {
        listings,
        nextCursor:
          hasMore && last
            ? encodeFavoritesCursor({
                v: 1,
                createdAt: last.created_at_precise,
                listingId: last.listing_id,
              })
            : null,
      };
    },

    ids(userId: string): Promise<string[]> {
      return listFavoriteIds(db.kysely, userId);
    },

    async add(userId: string, listingId: string): Promise<void> {
      // Чужой черновик и архив снаружи неотличимы от несуществующего дома.
      await requirePublishedListing(db.kysely, listingId);
      await addFavorite(db.kysely, userId, listingId);
    },

    async remove(userId: string, listingId: string): Promise<void> {
      await removeFavorite(db.kysely, userId, listingId);
    },
  };
}
