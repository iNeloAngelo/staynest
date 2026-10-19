import { sql } from 'kysely';
import type { Selectable, SelectQueryBuilder } from 'kysely';
import type { CatalogQuery } from '@staynest/shared';
import type { DbExecutor } from '../../platform/db/index';
import type { DB } from '../../platform/db/schema.generated';
import type { Amenities, ListingPhotos, Listings } from '../../platform/db/schema.generated';
import type { CatalogCursor } from './cursor';

export type CatalogRow = Selectable<Listings> & {
  rank: number | null;
  /** Точное время для курсора: миллисекунды JS теряют микросекунды Postgres. */
  published_at_precise: string;
};
export type CatalogPhotoRow = Selectable<ListingPhotos>;
export type CatalogAmenityRow = Selectable<Amenities> & { listing_id: string };

type CatalogBuilder = SelectQueryBuilder<DB, 'listings', CatalogRow>;

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * ts_rank_cd возвращает real, а pg отдаёт его в JS как округлённое число.
 * Приводим к float8 и в SELECT, и в WHERE, иначе курсор сравнивает разные
 * представления одного и того же ранга и теряет страницу.
 */
function publishedAtPrecise() {
  return sql<string>`to_char(listings.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

function rankExpression(q: string) {
  return sql<number>`ts_rank_cd(listings.search_tsv, websearch_to_tsquery('russian', ${q}))::float8`;
}

function filterQuery(query: CatalogBuilder, filters: CatalogQuery): CatalogBuilder {
  const conditions: Array<ReturnType<typeof sql<boolean>>> = [];

  if (filters.q) {
    conditions.push(sql<boolean>`(
      listings.search_tsv @@ websearch_to_tsquery('russian', ${filters.q})
      OR listings.city ILIKE ${likePattern(filters.q)} ESCAPE '\\'
    )`);
  }

  if (filters.city) conditions.push(sql<boolean>`lower(listings.city) = lower(${filters.city})`);
  if (filters.guests !== undefined) {
    conditions.push(sql<boolean>`listings.max_guests >= ${filters.guests}`);
  }
  if (filters.priceMin !== undefined) {
    conditions.push(sql<boolean>`listings.base_price_minor >= ${filters.priceMin}::bigint`);
  }
  if (filters.priceMax !== undefined) {
    conditions.push(sql<boolean>`listings.base_price_minor <= ${filters.priceMax}::bigint`);
  }
  if (filters.bedroomsMin !== undefined) {
    conditions.push(sql<boolean>`listings.bedrooms >= ${filters.bedroomsMin}`);
  }

  if (filters.type && filters.type.length > 0) {
    const values = sql.join(
      filters.type.map((type) => sql`${type}::listing_type`),
      sql`, `,
    );
    conditions.push(sql<boolean>`listings.type IN (${values})`);
  }

  if (filters.amenities && filters.amenities.length > 0) {
    const values = sql.join(
      filters.amenities.map((id) => sql`${id}::smallint`),
      sql`, `,
    );
    conditions.push(sql<boolean>`listings.id IN (
      SELECT la.listing_id FROM listing_amenities la
      WHERE la.amenity_id IN (${values})
      GROUP BY la.listing_id
      HAVING count(*) = ${filters.amenities.length}
    )`);
  }

  return conditions.reduce((builder, condition) => builder.where(condition), query);
}

function applyCursor(query: CatalogBuilder, cursor: CatalogCursor): CatalogBuilder {
  if (cursor.sort === 'price_asc') {
    return query.where(
      sql<boolean>`(listings.base_price_minor, listings.id) > (${cursor.price}::bigint, ${cursor.id}::uuid)`,
    );
  }

  if (cursor.sort === 'price_desc') {
    return query.where(
      sql<boolean>`(listings.base_price_minor, listings.id) < (${cursor.price}::bigint, ${cursor.id}::uuid)`,
    );
  }

  if (cursor.sort === 'newest') {
    return query.where(
      sql<boolean>`(listings.published_at, listings.id) < (${cursor.publishedAt}::timestamptz, ${cursor.id}::uuid)`,
    );
  }

  return query.where(sql<boolean>`(
    (ts_rank_cd(listings.search_tsv, websearch_to_tsquery('russian', ${cursor.query}))::float8,
     listings.published_at,
     listings.id)
    < (${cursor.rank}::float8, ${cursor.publishedAt}::timestamptz, ${cursor.id}::uuid)
  )`);
}

function orderBy(query: CatalogBuilder, sort: string, q: string | undefined): CatalogBuilder {
  if (sort === 'price_asc') {
    return query.orderBy('listings.base_price_minor', 'asc').orderBy('listings.id', 'asc');
  }

  if (sort === 'price_desc') {
    return query.orderBy('listings.base_price_minor', 'desc').orderBy('listings.id', 'desc');
  }

  if (sort === 'relevance') {
    return query
      .orderBy(rankExpression(q ?? ''), 'desc')
      .orderBy('listings.published_at', 'desc')
      .orderBy('listings.id', 'desc');
  }

  return query.orderBy('listings.published_at', 'desc').orderBy('listings.id', 'desc');
}

export function listPublishedListings(
  executor: DbExecutor,
  filters: CatalogQuery,
  sort: string,
  cursor: CatalogCursor | null,
): Promise<CatalogRow[]> {
  const rank =
    sort === 'relevance' && filters.q ? rankExpression(filters.q) : sql<number>`0::float8`;

  let query: CatalogBuilder = executor
    .selectFrom('listings')
    .selectAll('listings')
    .select(rank.as('rank'))
    .select(publishedAtPrecise().as('published_at_precise'))
    .where('listings.status', '=', 'published')
    .where('listings.published_at', 'is not', null);

  query = filterQuery(query, filters);
  if (cursor) query = applyCursor(query, cursor);
  query = orderBy(query, sort, filters.q);

  return query.limit(filters.limit + 1).execute() as Promise<CatalogRow[]>;
}

export async function findPublishedListing(
  executor: DbExecutor,
  id: string,
): Promise<CatalogRow | undefined> {
  const row = await executor
    .selectFrom('listings')
    .selectAll('listings')
    .select(sql<number>`0::float8`.as('rank'))
    .select(publishedAtPrecise().as('published_at_precise'))
    .where('listings.id', '=', id)
    .where('listings.status', '=', 'published')
    .where('listings.published_at', 'is not', null)
    .executeTakeFirst();

  return row as CatalogRow | undefined;
}

export function listPhotos(executor: DbExecutor, listingIds: string[]): Promise<CatalogPhotoRow[]> {
  if (listingIds.length === 0) return Promise.resolve([]);

  return executor
    .selectFrom('listing_photos')
    .selectAll()
    .where('listing_id', 'in', listingIds)
    .orderBy('position', 'asc')
    .orderBy('created_at', 'asc')
    .execute();
}

export function listAmenities(
  executor: DbExecutor,
  listingIds: string[],
): Promise<CatalogAmenityRow[]> {
  if (listingIds.length === 0) return Promise.resolve([]);

  return executor
    .selectFrom('listing_amenities')
    .innerJoin('amenities', 'amenities.id', 'listing_amenities.amenity_id')
    .selectAll('amenities')
    .select('listing_amenities.listing_id')
    .where('listing_amenities.listing_id', 'in', listingIds)
    .orderBy('amenities.sort_order', 'asc')
    .orderBy('amenities.id', 'asc')
    .execute();
}

export async function suggestCities(
  executor: DbExecutor,
  query: string | undefined,
  limit: number,
): Promise<string[]> {
  let builder = executor
    .selectFrom('listings')
    .select(sql<string>`min(listings.city)`.as('city'))
    .where('status', '=', 'published')
    .where('city', 'is not', null)
    .where(sql<boolean>`char_length(btrim(listings.city)) > 0`);

  if (query) {
    builder = builder.where(sql<boolean>`listings.city ILIKE ${likePattern(query)} ESCAPE '\\'`);
  }

  const rows = await builder
    .groupBy(sql`lower(listings.city)`)
    .orderBy(sql`count(*)`, 'desc')
    .orderBy(sql`min(lower(listings.city))`, 'asc')
    .limit(limit)
    .execute();

  return rows.map((row) => row.city).filter((city): city is string => Boolean(city));
}
