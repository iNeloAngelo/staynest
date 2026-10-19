import type {
  PriceRuleDto,
  PriceRuleInput,
  PriceRulePatch,
  Quote,
  QuoteQuery,
} from '@staynest/shared';
import { todayInTimeZone } from '@staynest/shared';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import { AppError } from '../../platform/http/errors';
import { requirePublishedListing } from '../catalog/index';
import { requireOwnedListing } from '../listings/index';
import { loadUnavailableNights } from '../availability/index';
import { calculateQuote } from './calculator';
import type { PricingRule } from './calculator';
import { toPriceRuleDto } from './dto';
import { priceRuleNotFound, priceRuleNightsTooLong, quoteRejected } from './errors';
import {
  deletePriceRule,
  findPriceRule,
  insertPriceRule,
  listPriceRules,
  updatePriceRule,
} from './repo';
import type { PriceRuleRow } from './repo';

export type PricingServiceDependencies = {
  db: Db;
  config: AppConfig;
};

function invalidPeriod(): AppError {
  return new AppError({
    status: 422,
    code: 'validation_error',
    title: 'Unprocessable Entity',
    detail: 'Дата окончания не может быть раньше начала.',
    errors: [
      {
        path: 'dateTo',
        code: 'invalid_period',
        message: 'Дата окончания не может быть раньше начала.',
      },
    ],
  });
}

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

function quoteService({ db, config }: PricingServiceDependencies) {
  return {
    async quote(listingId: string, query: QuoteQuery): Promise<Quote> {
      const listing = await requirePublishedListing(db.kysely, listingId);
      const [rules, unavailable] = await Promise.all([
        listPriceRules(db.kysely, listingId),
        loadUnavailableNights(db.kysely, listingId, query.checkIn, query.checkOut),
      ]);

      const result = calculateQuote({
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        guests: query.guests,
        today: todayInTimeZone(config.listingTimeZone),
        listing: {
          maxGuests: listing.maxGuests,
          basePriceMinor: listing.basePriceMinor,
          weekendPriceMinor: listing.weekendPriceMinor,
          cleaningFeeMinor: listing.cleaningFeeMinor,
          minNights: listing.minNights,
          maxNights: listing.maxNights,
          currency: listing.currency,
        },
        rules: rules.map(toPricingRule),
        unavailable,
      });

      if (!result.ok) throw quoteRejected(result);
      return result.quote;
    },
  };
}

function rulesService({ db }: PricingServiceDependencies) {
  return {
    async listRules(ownerId: string, listingId: string): Promise<PriceRuleDto[]> {
      await requireOwnedListing(db.kysely, ownerId, listingId);
      return (await listPriceRules(db.kysely, listingId)).map(toPriceRuleDto);
    },

    async createRule(
      ownerId: string,
      listingId: string,
      input: PriceRuleInput,
    ): Promise<PriceRuleDto> {
      const listing = await requireOwnedListing(db.kysely, ownerId, listingId);
      if (
        input.minNights !== null &&
        input.minNights !== undefined &&
        input.minNights > listing.maxNights
      ) {
        throw priceRuleNightsTooLong(listing.maxNights);
      }
      return toPriceRuleDto(await insertPriceRule(db.kysely, listingId, input));
    },

    async updateRule(
      ownerId: string,
      listingId: string,
      ruleId: string,
      input: PriceRulePatch,
    ): Promise<PriceRuleDto> {
      const listing = await requireOwnedListing(db.kysely, ownerId, listingId);
      const existing = await findPriceRule(db.kysely, listingId, ruleId);
      if (!existing) throw priceRuleNotFound();

      const dateFrom = input.dateFrom ?? existing.date_from;
      const dateTo = input.dateTo ?? existing.date_to;
      if (dateTo < dateFrom) throw invalidPeriod();

      const minNights = input.minNights === undefined ? existing.min_nights : input.minNights;
      if (minNights !== null && minNights > listing.maxNights) {
        throw priceRuleNightsTooLong(listing.maxNights);
      }

      return toPriceRuleDto(await updatePriceRule(db.kysely, listingId, ruleId, input));
    },

    async removeRule(ownerId: string, listingId: string, ruleId: string): Promise<void> {
      await requireOwnedListing(db.kysely, ownerId, listingId);
      const deleted = await deletePriceRule(db.kysely, listingId, ruleId);
      if (!deleted) throw priceRuleNotFound();
    },
  };
}

export function createPricingService(deps: PricingServiceDependencies) {
  return {
    ...quoteService(deps),
    ...rulesService(deps),
  };
}
