import type { BlockDto } from '@staynest/shared';
import { addDays } from '@staynest/shared';
import type { BlockRangeRow } from './repo';

/** В API блокировка задаётся последней ночью включительно, в БД хранится `[from, to)`. */
export function toBlockDto(row: BlockRangeRow): BlockDto {
  return {
    id: row.id,
    listingId: row.listingId,
    dateFrom: row.from,
    dateTo: addDays(row.to, -1),
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}
