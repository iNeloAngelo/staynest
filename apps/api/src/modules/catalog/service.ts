import type {
  CatalogQuery,
  CitySuggestionsQuery,
  PublicListing,
  PublicListingsResponse,
  PublicListingSummary,
  StayPrice,
} from '@staynest/shared';
import { calculateStayPrice } from '@staynest/shared';
import type { Db, DbExecutor } from '../../platform/db/index';
import type { MediaStorage } from '../../platform/storage/index';
import type { CatalogCursor } from './cursor';
import { decodeCursor, encodeCursor, resolveSort } from './cursor';
import { toPublicListing, toPublicSummary } from './dto';
import { catalogListingNotFound, invalidCursor } from './errors';
import {
  findPublishedListing,
  listAmenities,
  listPhotos,
  listPriceRules,
  listPublishedIds,
  listPublishedListings,
  suggestCities,
} from './repo';
import { listPublishedSummariesByIds } from './summaries';
import type { CatalogPhotoRow, CatalogPriceRuleRow, CatalogRow } from './repo';

export type CatalogServiceDependencies = {
  db: Db;
  storage: MediaStorage;
};

function groupPhotos(rows: CatalogPhotoRow[]): Map<string, CatalogPhotoRow[]> {
  const groups = new Map<string, CatalogPhotoRow[]>();

  for (const row of rows) {
    const list = groups.get(row.listing_id) ?? [];
    list.push(row);
    groups.set(row.listing_id, list);
  }

  return groups;
}

function groupRules(rows: CatalogPriceRuleRow[]): Map<string, CatalogPriceRuleRow[]> {
  const groups = new Map<string, CatalogPriceRuleRow[]>();

  for (const row of rows) {
    const list = groups.get(row.listing_id) ?? [];
    list.push(row);
    groups.set(row.listing_id, list);
  }

  return groups;
}

function stayPriceFor(
  row: CatalogRow,
  rules: CatalogPriceRuleRow[],
  query: CatalogQuery,
): StayPrice | null {
  if (!query.checkIn || !query.checkOut) return null;

  return calculateStayPrice({
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    listing: {
      basePriceMinor: Number(row.base_price_minor ?? 0),
      weekendPriceMinor: row.weekend_price_minor === null ? null : Number(row.weekend_price_minor),
      cleaningFeeMinor: Number(row.cleaning_fee_minor),
      currency: row.currency.trim(),
    },
    rules: rules.map((rule) => ({
      id: rule.id,
      dateFrom: rule.date_from,
      dateTo: rule.date_to,
      nightlyPriceMinor: Number(rule.nightly_price_minor),
      priority: rule.priority,
    })),
  });
}

function toCursor(sort: string, row: CatalogRow, q: string | undefined): CatalogCursor {
  const base = { v: 1 as const, id: row.id };

  if (sort === 'price_asc' || sort === 'price_desc') {
    return { ...base, sort, price: Number(row.base_price_minor ?? 0) };
  }

  if (sort === 'relevance') {
    return {
      ...base,
      sort: 'relevance',
      query: q ?? '',
      rank: row.rank ?? 0,
      publishedAt: row.published_at_precise,
    };
  }

  return {
    ...base,
    sort: 'newest',
    publishedAt: row.published_at_precise,
  };
}

function decodedCursor(query: CatalogQuery, sort: string): CatalogCursor | null {
  if (!query.cursor) return null;

  const cursor = decodeCursor(query.cursor, sort as CatalogCursor['sort']);
  if (!cursor) throw invalidCursor();
  if (cursor.sort === 'relevance' && cursor.query !== (query.q ?? '')) throw invalidCursor();
  return cursor;
}

type ResponseInput = {
  rows: CatalogRow[];
  query: CatalogQuery;
  sort: string;
  storage: MediaStorage;
  photosByListing: Map<string, CatalogPhotoRow[]>;
  rulesByListing: Map<string, CatalogPriceRuleRow[]>;
};

function responseFor({
  rows,
  query,
  sort,
  storage,
  photosByListing,
  rulesByListing,
}: ResponseInput): PublicListingsResponse {
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];

  return {
    listings: page.map((row) =>
      toPublicSummary(
        row,
        photosByListing.get(row.id) ?? [],
        storage,
        stayPriceFor(row, rulesByListing.get(row.id) ?? [], query),
      ),
    ),
    nextCursor: hasMore && last ? encodeCursor(toCursor(sort, last, query.q)) : null,
  };
}

async function detail(
  executor: DbExecutor,
  id: string,
  storage: MediaStorage,
): Promise<PublicListing> {
  const row = await findPublishedListing(executor, id);
  if (!row) throw catalogListingNotFound();

  const [photos, amenities] = await Promise.all([
    listPhotos(executor, [id]),
    listAmenities(executor, [id]),
  ]);

  return toPublicListing(row, photos, amenities, storage);
}

export function createCatalogService({ db, storage }: CatalogServiceDependencies) {
  return {
    async list(query: CatalogQuery): Promise<PublicListingsResponse> {
      const sort = resolveSort(query.sort, query.q);
      const cursor = decodedCursor(query, sort);
      const rows = await listPublishedListings(db.kysely, query, sort, cursor);
      const ids = rows.slice(0, query.limit).map((row) => row.id);
      const [photos, rules] = await Promise.all([
        listPhotos(db.kysely, ids),
        query.checkIn && query.checkOut
          ? listPriceRules(db.kysely, ids)
          : Promise.resolve<CatalogPriceRuleRow[]>([]),
      ]);

      return responseFor({
        rows,
        query,
        sort,
        storage,
        photosByListing: groupPhotos(photos),
        rulesByListing: groupRules(rules),
      });
    },

    async detail(id: string): Promise<PublicListing> {
      return detail(db.kysely, id, storage);
    },

    /** Карточки для избранного: сохраняем порядок переданных id, архив скрываем. */
    async summariesByIds(ids: string[]): Promise<PublicListingSummary[]> {
      const unique = [...new Set(ids)];
      const rows = await listPublishedSummariesByIds(db.kysely, unique);
      if (rows.length === 0) return [];

      const photos = await listPhotos(
        db.kysely,
        rows.map((row) => row.id),
      );
      const byId = new Map(rows.map((row) => [row.id, row]));
      const photosByListing = groupPhotos(photos);

      return unique.flatMap((id) => {
        const row = byId.get(id);
        if (!row) return [];
        return [toPublicSummary(row, photosByListing.get(id) ?? [], storage)];
      });
    },

    async cities(query: CitySuggestionsQuery): Promise<string[]> {
      return suggestCities(db.kysely, query.q, query.limit);
    },

    /** Публичные страницы для sitemap: только опубликованные объявления. */
    async sitemapEntries(): Promise<{ id: string; publishedAt: string | null }[]> {
      const rows = await listPublishedIds(db.kysely);
      return rows.map((row) => ({
        id: row.id,
        publishedAt: row.published_at ? row.published_at.toISOString() : null,
      }));
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
