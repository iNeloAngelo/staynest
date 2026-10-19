import type { DbExecutor } from '../../platform/db/index';
import { loadUnavailableNights } from '../availability/index';
import type { BookableListingRef } from '../listings/index';
import { calculateQuote } from './calculator';
import type { PricingRule, QuoteResult } from './calculator';
import { listPriceRules } from './repo';
import type { PriceRuleRow } from './repo';

export type BookingQuoteInput = {
  listing: BookableListingRef;
  checkIn: string;
  checkOut: string;
  guests: number;
  today: string;
};

function toPricingRule(row: PriceRuleRow): PricingRule {
  return {
    id: row.id,
    name: row.name,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    nightlyPriceMinor: Number(row.nightly_price_minor),
    minNights: row.min_nights,
    priority: row.priority,
  };
}

/**
 * Расчёт для движка бронирования внутри его транзакции: правила и занятость
 * читаются после `FOR UPDATE` объявления, поэтому цена и доступность
 * согласованы с моментом вставки брони.
 */
export async function quoteForBooking(
  executor: DbExecutor,
  input: BookingQuoteInput,
): Promise<QuoteResult> {
  const rules = await listPriceRules(executor, input.listing.id);
  const unavailable = await loadUnavailableNights(
    executor,
    input.listing.id,
    input.checkIn,
    input.checkOut,
  );

  return calculateQuote({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.guests,
    today: input.today,
    listing: {
      maxGuests: input.listing.maxGuests,
      basePriceMinor: input.listing.basePriceMinor,
      weekendPriceMinor: input.listing.weekendPriceMinor,
      cleaningFeeMinor: input.listing.cleaningFeeMinor,
      minNights: input.listing.minNights,
      maxNights: input.listing.maxNights,
      currency: input.listing.currency,
    },
    rules: rules.map(toPricingRule),
    unavailable,
  });
}
