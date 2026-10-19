import { sql } from 'kysely';
import type { BookingStatus } from '@staynest/shared';
import type { DbExecutor } from '../../platform/db/index';

export type AvailabilityRange = {
  from: string;
  to: string;
  kind: 'booked' | 'blocked';
};

export type BlockRangeRow = {
  id: string;
  listingId: string;
  from: string;
  to: string;
  reason: string | null;
  createdAt: Date;
};

export type HostBookingRow = {
  id: string;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  guestName: string;
};

/** Pending с истёкшим TTL больше не занимает даты, даже если джоб отстаёт. */
function activeBookingCondition() {
  return sql<boolean>`(
    status = 'confirmed'
    OR (status = 'pending' AND (expires_at IS NULL OR expires_at > now()))
  )`;
}

export async function listAvailabilityRanges(
  executor: DbExecutor,
  listingId: string,
  from: string,
  to: string,
): Promise<AvailabilityRange[]> {
  const bookings = await executor
    .selectFrom('bookings')
    .select([
      sql<string>`lower(stay_range)::text`.as('from'),
      sql<string>`upper(stay_range)::text`.as('to'),
    ])
    .where('listing_id', '=', listingId)
    .where(activeBookingCondition())
    .where(sql<boolean>`stay_range && daterange(${from}::date, ${to}::date, '[)')`)
    .execute();

  const blocks = await executor
    .selectFrom('listing_blocks')
    .select([
      sql<string>`lower(block_range)::text`.as('from'),
      sql<string>`upper(block_range)::text`.as('to'),
    ])
    .where('listing_id', '=', listingId)
    .where(sql<boolean>`block_range && daterange(${from}::date, ${to}::date, '[)')`)
    .execute();

  return [
    ...bookings.map((row) => ({ ...row, kind: 'booked' as const })),
    ...blocks.map((row) => ({ ...row, kind: 'blocked' as const })),
  ];
}

function blockRangeSelection() {
  return [
    sql<string>`lower(block_range)::text`.as('from'),
    sql<string>`upper(block_range)::text`.as('to'),
  ];
}

export function listBlocks(executor: DbExecutor, listingId: string): Promise<BlockRangeRow[]> {
  return executor
    .selectFrom('listing_blocks')
    .select([
      'id',
      'listing_id as listingId',
      'reason',
      'created_at as createdAt',
      ...blockRangeSelection(),
    ])
    .where('listing_id', '=', listingId)
    .orderBy('block_range', 'asc')
    .execute() as Promise<BlockRangeRow[]>;
}

export function listHostBookings(
  executor: DbExecutor,
  listingId: string,
  from: string,
  to: string,
): Promise<HostBookingRow[]> {
  return executor
    .selectFrom('bookings')
    .innerJoin('users', 'users.id', 'bookings.guest_id')
    .select([
      'bookings.id',
      'bookings.status',
      sql<string>`lower(bookings.stay_range)::text`.as('checkIn'),
      sql<string>`upper(bookings.stay_range)::text`.as('checkOut'),
      'users.display_name as guestName',
    ])
    .where('bookings.listing_id', '=', listingId)
    .where(
      sql<boolean>`(
      bookings.status = 'confirmed'
      OR (bookings.status = 'pending' AND (bookings.expires_at IS NULL OR bookings.expires_at > now()))
    )`,
    )
    .where(sql<boolean>`stay_range && daterange(${from}::date, ${to}::date, '[)')`)
    .orderBy('bookings.check_in', 'asc')
    .execute() as Promise<HostBookingRow[]>;
}

export async function hasBookingOverlap(
  executor: DbExecutor,
  listingId: string,
  from: string,
  to: string,
): Promise<boolean> {
  const row = await executor
    .selectFrom('bookings')
    .select('id')
    .where('listing_id', '=', listingId)
    .where(activeBookingCondition())
    .where(sql<boolean>`stay_range && daterange(${from}::date, ${to}::date, '[)')`)
    .executeTakeFirst();

  return row !== undefined;
}

export async function hasBlockOverlap(
  executor: DbExecutor,
  listingId: string,
  from: string,
  to: string,
): Promise<boolean> {
  const row = await executor
    .selectFrom('listing_blocks')
    .select('id')
    .where('listing_id', '=', listingId)
    .where(sql<boolean>`block_range && daterange(${from}::date, ${to}::date, '[)')`)
    .executeTakeFirst();

  return row !== undefined;
}

export async function insertBlock(
  executor: DbExecutor,
  input: { listingId: string; from: string; to: string; reason: string | null },
): Promise<BlockRangeRow> {
  const inserted = await executor
    .insertInto('listing_blocks')
    .values({
      listing_id: input.listingId,
      block_range: sql`daterange(${input.from}::date, ${input.to}::date, '[)')`,
      reason: input.reason,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const row = await executor
    .selectFrom('listing_blocks')
    .select([
      'id',
      'listing_id as listingId',
      'reason',
      'created_at as createdAt',
      ...blockRangeSelection(),
    ])
    .where('id', '=', inserted.id)
    .executeTakeFirstOrThrow();

  return row as BlockRangeRow;
}

export async function deleteBlock(
  executor: DbExecutor,
  listingId: string,
  blockId: string,
): Promise<boolean> {
  const result = await executor
    .deleteFrom('listing_blocks')
    .where('id', '=', blockId)
    .where('listing_id', '=', listingId)
    .executeTakeFirst();

  return (result.numDeletedRows ?? 0n) > 0n;
}
