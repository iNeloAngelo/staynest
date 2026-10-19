import type {
  CatalogQuery,
  CitySuggestionsQuery,
  PublicListing,
  PublicListingsResponse,
} from '@staynest/shared';
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
  listPublishedListings,
  suggestCities,
} from './repo';
import type { CatalogPhotoRow, CatalogRow } from './repo';

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
};

function responseFor({
  rows,
  query,
  sort,
  storage,
  photosByListing,
}: ResponseInput): PublicListingsResponse {
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];

  return {
    listings: page.map((row) => toPublicSummary(row, photosByListing.get(row.id) ?? [], storage)),
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
      const photos = await listPhotos(db.kysely, ids);

      return responseFor({
        rows,
        query,
        sort,
        storage,
        photosByListing: groupPhotos(photos),
      });
    },

    async detail(id: string): Promise<PublicListing> {
      return detail(db.kysely, id, storage);
    },

    async cities(query: CitySuggestionsQuery): Promise<string[]> {
      return suggestCities(db.kysely, query.q, query.limit);
    },
  };
}
