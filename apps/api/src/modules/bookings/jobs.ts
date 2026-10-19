import { todayInTimeZone } from '@staynest/shared';
import type { BookingStatus } from '@staynest/shared';
import type { Logger } from 'pino';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { EventBus } from '../../platform/events/index';
import type { BookingEventPayload } from '../../platform/events/index';
import { deleteIdempotencyOlderThan } from './idempotency';
import {
  insertBookingEvent,
  lockConfirmedToComplete,
  lockExpiredPending,
  updateBookingStatus,
} from './repo';
import type { JobBookingRow } from './repo';

const JOB_BATCH_SIZE = 100;
const MAX_BATCHES = 10;
const IDEMPOTENCY_RETENTION_HOURS = 48;

export type BookingJobsDependencies = {
  db: Db;
  config: AppConfig;
  events: EventBus;
  logger: Logger;
  now?: () => Date;
};

function payloadOf(
  row: JobBookingRow,
  status: BookingStatus,
  occurredAt: string,
): BookingEventPayload {
  return {
    bookingId: row.id,
    listingId: row.listing_id,
    guestId: row.guest_id,
    hostId: row.listing_owner_id,
    status,
    occurredAt,
  };
}

async function expireBatch(db: Db, at: Date): Promise<JobBookingRow[]> {
  return db.kysely.transaction().execute(async (trx) => {
    const expired = await lockExpiredPending(trx, at, JOB_BATCH_SIZE);

    for (const row of expired) {
      await updateBookingStatus(trx, row.id, 'expired', {});
      await insertBookingEvent(trx, {
        bookingId: row.id,
        actorId: null,
        fromStatus: 'pending',
        toStatus: 'expired',
        note: 'expires_at',
      });
    }

    return expired;
  });
}

async function completeBatch(db: Db, today: string): Promise<JobBookingRow[]> {
  return db.kysely.transaction().execute(async (trx) => {
    const completed = await lockConfirmedToComplete(trx, today, JOB_BATCH_SIZE);

    for (const row of completed) {
      await updateBookingStatus(trx, row.id, 'completed', {});
      await insertBookingEvent(trx, {
        bookingId: row.id,
        actorId: null,
        fromStatus: 'confirmed',
        toStatus: 'completed',
        note: 'check_out',
      });
    }

    return completed;
  });
}

export function createBookingJobs(dependencies: BookingJobsDependencies) {
  const { db, config, events, logger } = dependencies;
  const now = dependencies.now ?? (() => new Date());

  return {
    /** pending с истёкшим expires_at → expired. */
    async expirePending(at: Date = now()): Promise<number> {
      let total = 0;

      for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
        const rows = await expireBatch(db, at);
        for (const row of rows) {
          events.publish('booking.expired', payloadOf(row, 'expired', at.toISOString()));
        }
        total += rows.length;
        if (rows.length < JOB_BATCH_SIZE) break;
      }

      if (total > 0) logger.info({ count: total }, 'bookings expired');
      return total;
    },

    /** confirmed с прошедшей датой выезда → completed. */
    async completePast(at: Date = now()): Promise<number> {
      const today = todayInTimeZone(config.listingTimeZone, at);
      let total = 0;

      for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
        const rows = await completeBatch(db, today);
        for (const row of rows) {
          events.publish('booking.completed', payloadOf(row, 'completed', at.toISOString()));
        }
        total += rows.length;
        if (rows.length < JOB_BATCH_SIZE) break;
      }

      if (total > 0) logger.info({ count: total }, 'bookings completed');
      return total;
    },

    /** Ключи идемпотентности живут 48 часов: дольше повторять запрос смысла нет. */
    async cleanupIdempotency(at: Date = now()): Promise<number> {
      const cutoff = new Date(at.getTime() - IDEMPOTENCY_RETENTION_HOURS * 3_600_000);
      const deleted = await deleteIdempotencyOlderThan(db.kysely, cutoff);
      if (deleted > 0) logger.info({ count: deleted }, 'idempotency keys cleaned');

      return deleted;
    },
  };
}
