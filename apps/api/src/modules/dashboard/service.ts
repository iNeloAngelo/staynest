import type { DashboardQuery, DashboardResponse, DashboardRevenueMonth } from '@staynest/shared';
import {
  DASHBOARD_OCCUPANCY_DAYS,
  DASHBOARD_UPCOMING_LIMIT,
  addDays,
  todayInTimeZone,
} from '@staynest/shared';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import {
  countHostListings,
  countPendingRequests,
  listUpcomingCheckIns,
  revenueByMonth,
  sumBlockedNights,
  sumBookedNights,
} from './repo';

export type DashboardServiceDependencies = {
  db: Db;
  config: AppConfig;
  now?: () => Date;
};

function monthKey(year: number, monthIndex: number): string {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Последние `count` месяцев включая текущий: строки без броней тоже нужны графику. */
function recentMonthKeys(today: string, count: number): string[] {
  const [year, month] = today.split('-').map(Number);
  const keys: string[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 - offset, 1));
    keys.push(monthKey(date.getUTCFullYear(), date.getUTCMonth()));
  }

  return keys;
}

function fillMonths(
  months: string[],
  rows: Awaited<ReturnType<typeof revenueByMonth>>,
): { currency: string; months: DashboardRevenueMonth[] } {
  const byMonth = new Map(rows.map((row) => [row.month, row]));
  const currency = rows[0]?.currency.trim() || 'RUB';

  return {
    currency,
    months: months.map((month) => {
      const row = byMonth.get(month);
      return {
        month,
        totalMinor: row ? Number(row.total_minor) : 0,
        bookings: row ? Number(row.bookings) : 0,
      };
    }),
  };
}

export function createDashboardService({
  db,
  config,
  now = () => new Date(),
}: DashboardServiceDependencies) {
  return {
    async summary(ownerId: string, query: DashboardQuery): Promise<DashboardResponse> {
      const today = todayInTimeZone(config.listingTimeZone, now());
      const windowTo = addDays(today, DASHBOARD_OCCUPANCY_DAYS);
      const monthKeys = recentMonthKeys(today, query.months);
      const fromMonth = monthKeys[0] ?? today.slice(0, 7);

      const [homes, pendingRequests, upcoming, bookedNights, blockedNights, revenueRows] =
        await Promise.all([
          countHostListings(db.kysely, ownerId),
          countPendingRequests(db.kysely, ownerId),
          listUpcomingCheckIns(db.kysely, ownerId, {
            from: today,
            to: windowTo,
            limit: DASHBOARD_UPCOMING_LIMIT,
          }),
          sumBookedNights(db.kysely, ownerId, today, windowTo),
          sumBlockedNights(db.kysely, ownerId, today, windowTo),
          revenueByMonth(db.kysely, ownerId, fromMonth),
        ]);

      const occupiedNights = bookedNights + blockedNights;
      // Занятость — доля занятых ночей от всех ночей всех опубликованных домов.
      const totalNights = DASHBOARD_OCCUPANCY_DAYS * Math.max(1, homes);

      return {
        today,
        pendingRequests,
        upcomingCheckIns: upcoming.map((row) => ({
          bookingId: row.booking_id,
          listingId: row.listing_id,
          listingTitle: row.listing_title,
          city: row.city,
          guestName: row.guest_name,
          checkIn: row.check_in,
          checkOut: row.check_out,
          guestsCount: row.guests_count,
        })),
        occupancy: {
          from: today,
          to: windowTo,
          totalNights,
          bookedNights,
          blockedNights,
          occupiedNights,
          percent: Math.min(100, Math.round((occupiedNights / totalNights) * 100)),
        },
        revenue: fillMonths(monthKeys, revenueRows),
      };
    },
  };
}
