import type {
  BlockInput,
  BlockDto,
  CalendarQuery,
  CalendarResponse,
  HostCalendarResponse,
} from '@staynest/shared';
import { addDays, todayInTimeZone } from '@staynest/shared';
import { requirePublishedListing } from '../catalog/index';
import { requireOwnedListing } from '../listings/index';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import { loadUnavailableNights } from './access';
import { toBlockDto } from './dto';
import { blockInPast, blockNotFound, blockOverlaps, blockOverlapsBooking } from './errors';
import {
  deleteBlock,
  hasBlockOverlap,
  hasBookingOverlap,
  insertBlock,
  listBlocks,
  listHostBookings,
} from './repo';

export type AvailabilityServiceDependencies = {
  db: Db;
  config: AppConfig;
};

function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23P01'
  );
}

function todayOf(config: AppConfig): string {
  return todayInTimeZone(config.listingTimeZone);
}

function calendarService({ db, config }: AvailabilityServiceDependencies) {
  return {
    async publicCalendar(id: string, query: CalendarQuery): Promise<CalendarResponse> {
      const listing = await requirePublishedListing(db.kysely, id);
      const unavailable = await loadUnavailableNights(db.kysely, id, query.from, query.to);

      return {
        listingId: listing.id,
        from: query.from,
        to: query.to,
        today: todayOf(config),
        minNights: listing.minNights,
        maxNights: listing.maxNights,
        basePriceMinor: listing.basePriceMinor,
        weekendPriceMinor: listing.weekendPriceMinor,
        cleaningFeeMinor: listing.cleaningFeeMinor,
        currency: listing.currency,
        unavailable,
      };
    },

    async hostCalendar(
      ownerId: string,
      id: string,
      query: CalendarQuery,
    ): Promise<HostCalendarResponse> {
      await requireOwnedListing(db.kysely, ownerId, id);

      const [bookings, blocks] = await Promise.all([
        listHostBookings(db.kysely, id, query.from, query.to),
        listBlocks(db.kysely, id),
      ]);

      return {
        listingId: id,
        from: query.from,
        to: query.to,
        today: todayOf(config),
        bookings,
        blocks: blocks.map(toBlockDto),
      };
    },
  };
}

function blocksService({ db, config }: AvailabilityServiceDependencies) {
  return {
    async blocks(ownerId: string, id: string): Promise<BlockDto[]> {
      await requireOwnedListing(db.kysely, ownerId, id);
      return (await listBlocks(db.kysely, id)).map(toBlockDto);
    },

    async createBlock(ownerId: string, id: string, input: BlockInput): Promise<BlockDto> {
      const start = input.dateFrom;
      const end = addDays(input.dateTo, 1);

      if (start < todayOf(config)) throw blockInPast();

      try {
        const row = await db.kysely.transaction().execute(async (trx) => {
          // Та же блокировка строки объявления, что и при создании брони: даты
          // блокировки и брони не проскочат друг мимо друга.
          await requireOwnedListing(trx, ownerId, id, { lock: true });

          if (await hasBookingOverlap(trx, id, start, end)) throw blockOverlapsBooking();
          if (await hasBlockOverlap(trx, id, start, end)) throw blockOverlaps();

          return insertBlock(trx, {
            listingId: id,
            from: start,
            to: end,
            reason: input.reason ?? null,
          });
        });

        return toBlockDto(row);
      } catch (error) {
        if (isExclusionViolation(error)) throw blockOverlaps();
        throw error;
      }
    },

    async removeBlock(ownerId: string, id: string, blockId: string): Promise<void> {
      await requireOwnedListing(db.kysely, ownerId, id);
      const deleted = await deleteBlock(db.kysely, id, blockId);
      if (!deleted) throw blockNotFound();
    },
  };
}

export function createAvailabilityService(deps: AvailabilityServiceDependencies) {
  return {
    ...calendarService(deps),
    ...blocksService(deps),
  };
}
