import { sql } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';
import type { FavoritesCursor } from './cursor';

export type FavoriteRow = {
  listing_id: string;
  created_at_precise: string;
};

/** Сколько id отдаём для сердечек: защита от мегабайтного ответа. */
const FAVORITE_IDS_LIMIT = 1000;

function preciseCreatedAt() {
  return sql<string>`to_char(favorites.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

export function listFavorites(
  executor: DbExecutor,
  userId: string,
  cursor: FavoritesCursor | null,
  limit: number,
): Promise<FavoriteRow[]> {
  let query = executor
    .selectFrom('favorites')
    .innerJoin('listings', 'listings.id', 'favorites.listing_id')
    .select('favorites.listing_id')
    .select(preciseCreatedAt().as('created_at_precise'))
    .where('favorites.user_id', '=', userId)
    .where('listings.status', '=', 'published');

  if (cursor) {
    query = query.where(
      sql<boolean>`(favorites.created_at, favorites.listing_id) < (${cursor.createdAt}::timestamptz, ${cursor.listingId}::uuid)`,
    );
  }

  return query
    .orderBy('favorites.created_at', 'desc')
    .orderBy('favorites.listing_id', 'desc')
    .limit(limit + 1)
    .execute();
}

/**
 * Идентификаторы избранного для сердечек. Возвращаем только опубликованные
 * дома: архивная карточка больше не открывается, и сердечко на ней бессмысленно.
 */
export function listFavoriteIds(
  executor: DbExecutor,
  userId: string,
  limit = FAVORITE_IDS_LIMIT,
): Promise<string[]> {
  return executor
    .selectFrom('favorites')
    .innerJoin('listings', 'listings.id', 'favorites.listing_id')
    .select('favorites.listing_id')
    .where('favorites.user_id', '=', userId)
    .where('listings.status', '=', 'published')
    .orderBy('favorites.created_at', 'desc')
    .orderBy('favorites.listing_id', 'desc')
    .limit(limit)
    .execute()
    .then((rows) => rows.map((row) => row.listing_id));
}

export async function addFavorite(
  executor: DbExecutor,
  userId: string,
  listingId: string,
): Promise<void> {
  await executor
    .insertInto('favorites')
    .values({ user_id: userId, listing_id: listingId })
    .onConflict((conflict) => conflict.columns(['user_id', 'listing_id']).doNothing())
    .execute();
}

export async function removeFavorite(
  executor: DbExecutor,
  userId: string,
  listingId: string,
): Promise<void> {
  await executor
    .deleteFrom('favorites')
    .where('user_id', '=', userId)
    .where('listing_id', '=', listingId)
    .execute();
}
