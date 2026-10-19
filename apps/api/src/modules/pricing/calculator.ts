import type {
  Quote,
  QuoteGroup,
  QuoteNight,
  StayPriceListing,
  StayPriceRule,
} from '@staynest/shared';
import { choosePriceRule, eachNight, nightsBetween, priceNights } from '@staynest/shared';

export type PricingListing = StayPriceListing & {
  maxGuests: number;
  cleaningFeeMinor: number;
  minNights: number;
  maxNights: number;
  currency: string;
};

export type PricingRule = StayPriceRule & {
  name: string;
  minNights: number | null;
};

type UnavailableNight = {
  date: string;
  kind: 'booked' | 'blocked';
};

export type QuoteInput = {
  checkIn: string;
  checkOut: string;
  guests: number;
  today: string;
  listing: PricingListing;
  rules: PricingRule[];
  unavailable: UnavailableNight[];
};

type QuoteIssuePath = 'checkIn' | 'checkOut' | 'guests';

type QuoteIssue = {
  path: QuoteIssuePath;
  code: string;
  message: string;
  minNights?: number;
};

export type QuoteFailure = {
  ok: false;
  status: 409 | 422;
  code: string;
  issues: QuoteIssue[];
};

type QuoteSuccess = { ok: true; quote: Quote };
export type QuoteResult = QuoteSuccess | QuoteFailure;

type QuoteProblem = {
  status: 409 | 422;
  code: string;
  issues: QuoteIssue[];
};

function failQuote(problem: QuoteProblem): QuoteFailure {
  return { ok: false, ...problem };
}

function groupNights(nights: QuoteNight[], rules: PricingRule[]): QuoteGroup[] {
  const groups: QuoteGroup[] = [];

  for (const night of nights) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.priceMinor === night.priceMinor &&
      last.source === night.source &&
      last.ruleId === night.ruleId
    ) {
      last.nights += 1;
      continue;
    }

    groups.push({
      priceMinor: night.priceMinor,
      nights: 1,
      source: night.source,
      ruleId: night.ruleId,
      ruleName: rules.find((rule) => rule.id === night.ruleId)?.name ?? null,
    });
  }

  return groups;
}

function nightsProblem(code: string, message: string): QuoteFailure {
  return failQuote({ status: 422, code, issues: [{ path: 'checkOut', code, message }] });
}

function validateStay(input: QuoteInput, nights: number): QuoteFailure | null {
  if (input.checkIn >= input.checkOut) {
    return failQuote({
      status: 422,
      code: 'invalid_date_range',
      issues: [
        {
          path: 'checkOut',
          code: 'invalid_date_range',
          message: 'Дата выезда должна быть позже даты заезда.',
        },
      ],
    });
  }

  if (input.checkIn < input.today) {
    return failQuote({
      status: 422,
      code: 'stay_in_past',
      issues: [{ path: 'checkIn', code: 'stay_in_past', message: 'Дата заезда уже прошла.' }],
    });
  }

  if (input.guests > input.listing.maxGuests) {
    return failQuote({
      status: 422,
      code: 'guests_exceed_capacity',
      issues: [
        {
          path: 'guests',
          code: 'guests_exceed_capacity',
          message: `Дом принимает не больше ${input.listing.maxGuests} гостей.`,
        },
      ],
    });
  }

  if (nights > input.listing.maxNights) {
    return nightsProblem(
      'max_nights_exceeded',
      `Максимальный срок — ${input.listing.maxNights} ночей.`,
    );
  }

  return null;
}

function minNightsFor(nights: string[], listing: PricingListing, rules: PricingRule[]): number {
  let minimum = listing.minNights;

  for (const night of nights) {
    const rule = choosePriceRule(night, rules);
    if (rule?.minNights !== null && rule?.minNights !== undefined && rule.minNights > minimum) {
      minimum = rule.minNights;
    }
  }

  return minimum;
}

function availabilityProblem(
  nights: string[],
  unavailable: UnavailableNight[],
): QuoteFailure | null {
  const busy = new Set(unavailable.map((night) => night.date));
  const firstBusy = nights.find((night) => busy.has(night));

  if (!firstBusy) return null;

  return failQuote({
    status: 409,
    code: 'dates_unavailable',
    issues: [
      {
        path: 'checkIn',
        code: 'dates_unavailable',
        message: 'Эти даты уже заняты. Выберите другие даты.',
      },
    ],
  });
}

/**
 * Чистый расчёт без БД и без `Date`: всё, что нужно, передаёт сервис.
 * Клиент получает готовую сумму и не пересчитывает её сам.
 */
export function calculateQuote(input: QuoteInput): QuoteResult {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const stayProblem = validateStay(input, nights);
  if (stayProblem) return stayProblem;

  const dates = eachNight(input.checkIn, input.checkOut);
  const minimum = minNightsFor(dates, input.listing, input.rules);
  if (nights < minimum) {
    return failQuote({
      status: 422,
      code: 'min_nights_not_met',
      issues: [
        {
          path: 'checkOut',
          code: 'min_nights_not_met',
          message: `Минимальный срок — ${minimum} ночей.`,
          minNights: minimum,
        },
      ],
    });
  }

  const unavailable = availabilityProblem(dates, input.unavailable);
  if (unavailable) return unavailable;

  const nightly: QuoteNight[] = priceNights(
    input.checkIn,
    input.checkOut,
    input.listing,
    input.rules,
  ).map((night) => ({
    date: night.date,
    priceMinor: night.priceMinor,
    source: night.source,
    ruleId: night.rule?.id ?? null,
  }));
  const nightlyTotalMinor = nightly.reduce((total, night) => total + night.priceMinor, 0);

  return {
    ok: true,
    quote: {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights,
      guests: input.guests,
      currency: input.listing.currency,
      minNightsApplied: minimum,
      maxNights: input.listing.maxNights,
      nightly,
      groups: groupNights(nightly, input.rules),
      nightlyTotalMinor,
      cleaningFeeMinor: input.listing.cleaningFeeMinor,
      serviceFeeMinor: 0,
      totalMinor: nightlyTotalMinor + input.listing.cleaningFeeMinor,
    },
  };
}
