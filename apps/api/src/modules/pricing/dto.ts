import type { PriceRuleDto } from '@staynest/shared';
import type { PriceRuleRow } from './repo';

export function toPriceRuleDto(row: PriceRuleRow): PriceRuleDto {
  return {
    id: row.id,
    listingId: row.listing_id,
    name: row.name,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    nightlyPriceMinor: Number(row.nightly_price_minor),
    minNights: row.min_nights,
    priority: row.priority,
    createdAt: row.created_at.toISOString(),
  };
}
