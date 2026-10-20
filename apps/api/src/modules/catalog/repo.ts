import { sql } from 'kysely';
import type { QueryCreator, Selectable, SelectQueryBuilder } from 'kysely';
import type { CatalogQuery } from '@staynest/shared';
import type { DbExecutor } from '../../platform/db/index';
import type { DB } from '../../platform/db/schema.generated';
import type {
  Amenities,
  ListingPhotos,
  ListingPriceRules,
  Listings,
} from '../../platform/db/schema.generated';
import type { CatalogCursor } from './cursor';

export type CatalogRow = Selectable<Listings> & {
  rank: number | null;
  /** Точное время для курсора: миллисекунды JS теряют микросекунды Postgres. */
  published_at_precise: string;
};
export type CatalogPhotoRow = Selectable<ListingPhotos>;
export type CatalogAmenityRow = Selectable<Amenities> & { listing_id: string };
export type CatalogPriceRuleRow = Selectable<ListingPriceRules>;

/** Контекст запроса каталога: к таблицам добавлен материализованный `busy`. */
type CatalogDb = DB & { busy: { listing_id: string } };
type CatalogBuilder = SelectQueryBuilder<CatalogDb, 'listings', CatalogRow>;

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

/**
 * Материализованный набор занятых домов. Без него планировщик иногда выбирает
 * nested loop anti join и сортирует все совпадения по `q` (до 10 000 строк).
 * Хеш-анти-джойн с готовым `busy` стабильно отсекает занятые дома до сортировки.
 */
function busyListings(db: QueryCreator<DB>, filters: CatalogQuery) {
  if (!filters.checkIn || !filters.checkOut) {
    return db
      .selectFrom('bookings')
      .select('listing_id')
      .where(sql<boolean>`false`);
  }

  const range = sql<boolean>`daterange(${filters.checkIn}::date, ${filters.checkOut}::date, '[)')`;
  const booked = db
    .selectFrom('bookings')
    .select('listing_id')
    .where(
      sql<boolean>`(
      status = 'confirmed'
      OR (status = 'pending' AND (expires_at IS NULL OR expires_at > now()))
    )`,
    )
    .where(sql<boolean>`stay_range && ${range}`);
  const blocked = db
    .selectFrom('listing_blocks')
    .select('listing_id')
    .where(sql<boolean>`block_range && ${range}`);

  return booked.union(blocked);
}

/** Все запросы каталога видят `busy`; при отсутствии дат CTE пустая. */
function withAvailability(executor: DbExecutor, filters: CatalogQuery) {
  return executor.with(
    (cte) => cte('busy').materialized(),
    (db) => busyListings(db, filters),
  );
}

function availabilityConditions(filters: CatalogQuery): Array<ReturnType<typeof sql<boolean>>> {
  if (!filters.checkIn || !filters.checkOut) return [];

  return [sql<boolean>`NOT EXISTS (SELECT 1 FROM busy WHERE busy.listing_id = listings.id)`];
}

function filterQuery<O>(
  query: SelectQueryBuilder<CatalogDb, 'listings', O>,
  filters: CatalogQuery,
): SelectQueryBuilder<CatalogDb, 'listings', O> {
  const conditions: Array<ReturnType<typeof sql<boolean>>> = [];

  if (filters.q) {
    conditions.push(sql<boolean>`(
      listings.search_tsv @@ websearch_to_tsquery('russian', ${filters.q})
      OR listings.city ILIKE ${likePattern(filters.q)} ESCAPE '\\'
    )`);
  }

  if (filters.city) conditions.push(sql<boolean>`lower(listings.city) = lower(${filters.city})`);

  conditions.push(...availabilityConditions(filters));

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

function applyCursor<O>(
  query: SelectQueryBuilder<CatalogDb, 'listings', O>,
  cursor: CatalogCursor,
): SelectQueryBuilder<CatalogDb, 'listings', O> {
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

function orderBy<O>(
  query: SelectQueryBuilder<CatalogDb, 'listings', O>,
  sort: string,
  q: string | undefined,
): SelectQueryBuilder<CatalogDb, 'listings', O> {
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
  if (sort === 'relevance') return listByRelevance(executor, filters, cursor);

  const rank =
    sort === 'relevance' && filters.q ? rankExpression(filters.q) : sql<number>`0::float8`;

  let query: CatalogBuilder = withAvailability(executor, filters)
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

/**
 * Релевантность: сначала сортируем только `(rank, published_at, id)` на
 * индексе/скане, затем подтягиваем полные строки для одной страницы.
 * Если сортировать сразу всю ширину объявления, 10 000 совпадений по `q`
 * дают seq scan и сортировку ~8 МБ — заметно дороже лимита кадра.
 */
async function listByRelevance(
  executor: DbExecutor,
  filters: CatalogQuery,
  cursor: CatalogCursor | null,
): Promise<CatalogRow[]> {
  const rank = rankExpression(filters.q ?? '');

  let ranked: SelectQueryBuilder<
    CatalogDb,
    'listings',
    { id: string; rank: number; published_at_precise: string }
  > = withAvailability(executor, filters)
    .selectFrom('listings')
    .select(['listings.id', rank.as('rank'), publishedAtPrecise().as('published_at_precise')])
    .where('listings.status', '=', 'published')
    .where('listings.published_at', 'is not', null);

  ranked = filterQuery(ranked, filters);
  if (cursor) ranked = applyCursor(ranked, cursor);

  const rows = await executor
    .selectFrom(
      ranked
        .orderBy(rank, 'desc')
        .orderBy('listings.published_at', 'desc')
        .orderBy('listings.id', 'desc')
        .limit(filters.limit + 1)
        .as('ranked'),
    )
    .innerJoin('listings', 'listings.id', 'ranked.id')
    .selectAll('listings')
    .select('ranked.rank')
    .select('ranked.published_at_precise')
    .orderBy('ranked.rank', 'desc')
    .orderBy('listings.published_at', 'desc')
    .orderBy('listings.id', 'desc')
    .execute();

  return rows as CatalogRow[];
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

/** Read-only взгляд каталога в правила цен (ADR-017): нужен итог за период. */
export function listPriceRules(
  executor: DbExecutor,
  listingIds: string[],
): Promise<CatalogPriceRuleRow[]> {
  if (listingIds.length === 0) return Promise.resolve([]);

  return executor
    .selectFrom('listing_price_rules')
    .selectAll()
    .where('listing_id', 'in', listingIds)
    .orderBy('date_from', 'asc')
    .orderBy('priority', 'desc')
    .orderBy('id', 'asc')
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

/** Для sitemap.xml: только опубликованные id, свежие первыми. */
export async function listPublishedIds(
  executor: DbExecutor,
): Promise<{ id: string; published_at: Date | null }[]> {
  return executor
    .selectFrom('listings')
    .select(['id', 'published_at'])
    .where('status', '=', 'published')
    .orderBy('published_at', 'desc')
    .orderBy('id', 'desc')
    .limit(50_000)
    .execute();
}
