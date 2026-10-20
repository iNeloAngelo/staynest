import { sql } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';
import type { CatalogRow } from './repo';

/**
 * Публичные карточки по списку id: порядок задаёт вызывающий модуль (избранное).
 * Отдельный файл, чтобы `repo.ts` каталога оставался в пределах max-lines.
 */
export function listPublishedSummariesByIds(
  executor: DbExecutor,
  listingIds: string[],
): Promise<CatalogRow[]> {
  if (listingIds.length === 0) return Promise.resolve([]);

  return executor
    .selectFrom('listings')
    .selectAll('listings')
    .select(sql<number>`0::float8`.as('rank'))
    .select(
      sql<string>`to_char(listings.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as(
        'published_at_precise',
      ),
    )
    .where('listings.id', 'in', listingIds)
    .where('listings.status', '=', 'published')
    .where('listings.published_at', 'is not', null)
    .execute() as Promise<CatalogRow[]>;
}
