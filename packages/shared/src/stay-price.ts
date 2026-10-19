import { z } from 'zod';
import { eachNight, isWeekendNight, nightsBetween } from './dates';

/**
 * Чистое ядро расчёта цены проживания без БД, HTTP и `Date`.
 * Им пользуются и `/quote`, и каталог, чтобы итог за период не расходился
 * между карточкой выдачи и бронированием.
 */
export type StayPriceListing = {
  basePriceMinor: number;
  weekendPriceMinor: number | null;
};

export type StayPriceRule = {
  id: string;
  /** Первая ночь периода включительно. */
  dateFrom: string;
  /** Последняя ночь периода включительно. */
  dateTo: string;
  nightlyPriceMinor: number;
  priority: number;
};

export type StayPriceSource = 'seasonal' | 'weekend' | 'base';

export type PricedNight<T extends StayPriceRule = StayPriceRule> = {
  date: string;
  priceMinor: number;
  source: StayPriceSource;
  rule: T | null;
};

export const stayPriceSchema = z.object({
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  nights: z.number().int(),
  nightlyTotalMinor: z.number().int(),
  cleaningFeeMinor: z.number().int(),
  totalMinor: z.number().int(),
  currency: z.string(),
});

export type StayPrice = z.infer<typeof stayPriceSchema>;

/** Правило с максимальным приоритетом; при равенстве — более позднее и с меньшим id. */
export function choosePriceRule<T extends StayPriceRule>(
  night: string,
  rules: readonly T[],
): T | null {
  let winner: T | null = null;

  for (const rule of rules) {
    if (rule.dateFrom > night || rule.dateTo < night) continue;

    if (
      winner === null ||
      rule.priority > winner.priority ||
      (rule.priority === winner.priority && rule.dateFrom > winner.dateFrom) ||
      (rule.priority === winner.priority &&
        rule.dateFrom === winner.dateFrom &&
        rule.id < winner.id)
    ) {
      winner = rule;
    }
  }

  return winner;
}

/** Цена каждой ночи диапазона `[checkIn, checkOut)`: сезон → выходные → база. */
export function priceNights<T extends StayPriceRule>(
  checkIn: string,
  checkOut: string,
  listing: StayPriceListing,
  rules: readonly T[],
): Array<PricedNight<T>> {
  return eachNight(checkIn, checkOut).map((date) => {
    const rule = choosePriceRule(date, rules);
    if (rule) {
      return { date, priceMinor: rule.nightlyPriceMinor, source: 'seasonal', rule };
    }

    if (listing.weekendPriceMinor !== null && isWeekendNight(date)) {
      return { date, priceMinor: listing.weekendPriceMinor, source: 'weekend', rule: null };
    }

    return { date, priceMinor: listing.basePriceMinor, source: 'base', rule: null };
  });
}

export type StayPriceInput<T extends StayPriceRule> = {
  checkIn: string;
  checkOut: string;
  listing: StayPriceListing & { cleaningFeeMinor: number; currency: string };
  rules: readonly T[];
};

/** Итог за период без проверки занятости и минимального срока — для карточки каталога. */
export function calculateStayPrice<T extends StayPriceRule>(input: StayPriceInput<T>): StayPrice {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const nightlyTotalMinor = priceNights(
    input.checkIn,
    input.checkOut,
    input.listing,
    input.rules,
  ).reduce((total, night) => total + night.priceMinor, 0);

  return {
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights,
    nightlyTotalMinor,
    cleaningFeeMinor: input.listing.cleaningFeeMinor,
    totalMinor: nightlyTotalMinor + input.listing.cleaningFeeMinor,
    currency: input.listing.currency,
  };
}
