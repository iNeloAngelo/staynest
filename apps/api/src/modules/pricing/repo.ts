import type { PriceRuleInput, PriceRulePatch } from '@staynest/shared';
import type { DbExecutor } from '../../platform/db/index';
import type { ListingPriceRules } from '../../platform/db/schema.generated';
import type { Selectable } from 'kysely';

export type PriceRuleRow = Selectable<ListingPriceRules>;

export function listPriceRules(executor: DbExecutor, listingId: string): Promise<PriceRuleRow[]> {
  return executor
    .selectFrom('listing_price_rules')
    .selectAll()
    .where('listing_id', '=', listingId)
    .orderBy('date_from', 'asc')
    .orderBy('priority', 'desc')
    .orderBy('id', 'asc')
    .execute();
}

export function findPriceRule(
  executor: DbExecutor,
  listingId: string,
  ruleId: string,
): Promise<PriceRuleRow | undefined> {
  return executor
    .selectFrom('listing_price_rules')
    .selectAll()
    .where('listing_id', '=', listingId)
    .where('id', '=', ruleId)
    .executeTakeFirst();
}

export function insertPriceRule(
  executor: DbExecutor,
  listingId: string,
  input: PriceRuleInput,
): Promise<PriceRuleRow> {
  return executor
    .insertInto('listing_price_rules')
    .values({
      listing_id: listingId,
      name: input.name,
      date_from: input.dateFrom,
      date_to: input.dateTo,
      nightly_price_minor: input.nightlyPriceMinor,
      min_nights: input.minNights ?? null,
      priority: input.priority ?? 0,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function updatePriceRule(
  executor: DbExecutor,
  listingId: string,
  ruleId: string,
  input: PriceRulePatch,
): Promise<PriceRuleRow> {
  return executor
    .updateTable('listing_price_rules')
    .set({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.dateFrom === undefined ? {} : { date_from: input.dateFrom }),
      ...(input.dateTo === undefined ? {} : { date_to: input.dateTo }),
      ...(input.nightlyPriceMinor === undefined
        ? {}
        : { nightly_price_minor: input.nightlyPriceMinor }),
      ...(input.minNights === undefined ? {} : { min_nights: input.minNights }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
    })
    .where('id', '=', ruleId)
    .where('listing_id', '=', listingId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deletePriceRule(
  executor: DbExecutor,
  listingId: string,
  ruleId: string,
): Promise<boolean> {
  const result = await executor
    .deleteFrom('listing_price_rules')
    .where('id', '=', ruleId)
    .where('listing_id', '=', listingId)
    .executeTakeFirst();

  return (result.numDeletedRows ?? 0n) > 0n;
}
