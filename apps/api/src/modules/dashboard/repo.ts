import { sql } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';

export type DashboardCheckInRow = {
  booking_id: string;
  listing_id: string;
  listing_title: string;
  city: string | null;
  guest_name: string;
  check_in: string;
  check_out: string;
  guests_count: number;
};

export type DashboardRevenueRow = {
  month: string;
  total_minor: string;
  bookings: number;
  currency: string;
};

/** Заявки, которые ещё ждут ответа: просроченные не считаем, даже если джоб отстал. */
export async function countPendingRequests(executor: DbExecutor, ownerId: string): Promise<number> {
  const row = await executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('listings.owner_id', '=', ownerId)
    .where('bookings.status', '=', 'pending')
    .where(sql<boolean>`(bookings.expires_at IS NULL OR bookings.expires_at > now())`)
    .executeTakeFirstOrThrow();

  return Number(row.count);
}

export type UpcomingWindow = {
  from: string;
  to: string;
  limit: number;
};

export function listUpcomingCheckIns(
  executor: DbExecutor,
  ownerId: string,
  { from, to, limit }: UpcomingWindow,
): Promise<DashboardCheckInRow[]> {
  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .innerJoin('users', 'users.id', 'bookings.guest_id')
    .select([
      'bookings.id as booking_id',
      'bookings.listing_id',
      'listings.title as listing_title',
      'listings.city',
      'users.display_name as guest_name',
      'bookings.check_in',
      'bookings.check_out',
      'bookings.guests_count',
    ])
    .where('listings.owner_id', '=', ownerId)
    .where('bookings.status', '=', 'confirmed')
    .where(sql<boolean>`bookings.check_in >= ${from}::date`)
    .where(sql<boolean>`bookings.check_in < ${to}::date`)
    .orderBy('bookings.check_in', 'asc')
    .orderBy('bookings.id', 'asc')
    .limit(limit)
    .execute() as Promise<DashboardCheckInRow[]>;
}

/** Ночи подтверждённых броней, попавшие в окно `[from, to)`. */
export async function sumBookedNights(
  executor: DbExecutor,
  ownerId: string,
  from: string,
  to: string,
): Promise<number> {
  const row = await executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .select(
      sql<string>`COALESCE(SUM(GREATEST(
        LEAST(upper(bookings.stay_range), ${to}::date) -
        GREATEST(lower(bookings.stay_range), ${from}::date), 0)), 0)::text`.as('nights'),
    )
    .where('listings.owner_id', '=', ownerId)
    .where('bookings.status', '=', 'confirmed')
    .where(sql<boolean>`bookings.stay_range && daterange(${from}::date, ${to}::date, '[)')`)
    .executeTakeFirstOrThrow();

  return Number(row.nights);
}

/** Ночи, занятые блокировками хозяина в окне `[from, to)`. */
export async function sumBlockedNights(
  executor: DbExecutor,
  ownerId: string,
  from: string,
  to: string,
): Promise<number> {
  const row = await executor
    .selectFrom('listing_blocks')
    .innerJoin('listings', 'listings.id', 'listing_blocks.listing_id')
    .select(
      sql<string>`COALESCE(SUM(GREATEST(
        LEAST(upper(listing_blocks.block_range), ${to}::date) -
        GREATEST(lower(listing_blocks.block_range), ${from}::date), 0)), 0)::text`.as('nights'),
    )
    .where('listings.owner_id', '=', ownerId)
    .where(sql<boolean>`listing_blocks.block_range && daterange(${from}::date, ${to}::date, '[)')`)
    .executeTakeFirstOrThrow();

  return Number(row.nights);
}

/** Доход по месяцу заезда: подтверждённые и завершённые брони. */
export function revenueByMonth(
  executor: DbExecutor,
  ownerId: string,
  fromMonth: string,
): Promise<DashboardRevenueRow[]> {
  const month = sql<string>`to_char(bookings.check_in, 'YYYY-MM')`;

  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .select(month.as('month'))
    .select(sql<string>`COALESCE(SUM(bookings.total_minor), 0)::text`.as('total_minor'))
    .select(sql<number>`count(*)::int`.as('bookings'))
    .select(sql<string>`min(bookings.currency)`.as('currency'))
    .where('listings.owner_id', '=', ownerId)
    .where('bookings.status', 'in', ['confirmed', 'completed'])
    .where(sql<boolean>`bookings.check_in >= ${`${fromMonth}-01`}::date`)
    .groupBy(month)
    .orderBy(month, 'asc')
    .execute();
}
