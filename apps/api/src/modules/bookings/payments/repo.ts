import { sql } from 'kysely';
import type { Selectable } from 'kysely';
import type { DbExecutor } from '../../../platform/db/index';
import type { Json, Payments } from '../../../platform/db/schema.generated';
import { MOCK_PROVIDER } from './provider';

export type PaymentRow = Selectable<Payments>;

export type PaymentSessionRow = PaymentRow & {
  booking_status: string;
  deposit_due_at: Date | null;
  listing_title: string;
  check_in: string | null;
  check_out: string | null;
};

export type UnpaidBookingRow = {
  id: string;
  listing_id: string;
  guest_id: string;
  listing_owner_id: string;
  listing_title: string;
  check_in: string | null;
  check_out: string | null;
  guest_display_name: string;
  total_minor: string;
  currency: string;
  deposit_due_at: Date;
};

export type PaymentBookingRow = {
  id: string;
  status: string;
  guest_id: string;
  listing_owner_id: string;
  listing_title: string;
  check_in: string | null;
  check_out: string | null;
  guest_display_name: string;
  total_minor: string;
  currency: string;
  deposit_due_at: Date | null;
};

export function insertDeposit(
  executor: DbExecutor,
  input: { bookingId: string; amountMinor: number; currency: string },
): Promise<PaymentRow> {
  return executor
    .insertInto('payments')
    .values({
      booking_id: input.bookingId,
      provider: MOCK_PROVIDER,
      kind: 'deposit',
      status: 'created',
      amount_minor: input.amountMinor,
      currency: input.currency,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function listDeposits(executor: DbExecutor, bookingId: string): Promise<PaymentRow[]> {
  return executor
    .selectFrom('payments')
    .selectAll()
    .where('booking_id', '=', bookingId)
    .where('kind', '=', 'deposit')
    .orderBy('created_at', 'asc')
    .orderBy('id', 'asc')
    .execute();
}

function depositSessionQuery(executor: DbExecutor) {
  return executor
    .selectFrom('payments')
    .innerJoin('bookings', 'bookings.id', 'payments.booking_id')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .selectAll('payments')
    .select([
      'bookings.status as booking_status',
      'bookings.deposit_due_at',
      'listings.title as listing_title',
      'bookings.check_in',
      'bookings.check_out',
    ]);
}

export function findPaymentSession(
  executor: DbExecutor,
  externalId: string,
): Promise<PaymentSessionRow | undefined> {
  return depositSessionQuery(executor)
    .where('payments.provider', '=', 'mock')
    .where('payments.external_id', '=', externalId)
    .executeTakeFirst() as Promise<PaymentSessionRow | undefined>;
}

export function findPaymentByExternalId(
  executor: DbExecutor,
  externalId: string,
): Promise<PaymentRow | undefined> {
  return executor
    .selectFrom('payments')
    .selectAll()
    .where('provider', '=', MOCK_PROVIDER)
    .where('external_id', '=', externalId)
    .executeTakeFirst();
}

export function lockPaymentById(executor: DbExecutor, id: string): Promise<PaymentRow | undefined> {
  return executor
    .selectFrom('payments')
    .selectAll()
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst();
}

export function setPaymentSession(
  executor: DbExecutor,
  id: string,
  externalId: string,
): Promise<PaymentRow> {
  return executor
    .updateTable('payments')
    .set({ external_id: externalId })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function updatePaymentStatus(
  executor: DbExecutor,
  id: string,
  status: 'succeeded' | 'failed' | 'refunded',
  rawEvent: Json,
): Promise<PaymentRow> {
  return executor
    .updateTable('payments')
    .set({ status, raw_event: rawEvent })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Возврат после отмены: успешный депозит становится refunded. */
export async function refundSucceededDeposit(
  executor: DbExecutor,
  bookingId: string,
  reason: string,
): Promise<number> {
  const rows = await executor
    .updateTable('payments')
    .set({
      status: 'refunded',
      raw_event: sql<Json>`coalesce(raw_event, '{}'::jsonb) || ${JSON.stringify({ refundReason: reason })}::jsonb`,
    })
    .where('booking_id', '=', bookingId)
    .where('kind', '=', 'deposit')
    .where('status', '=', 'succeeded')
    .returning('id')
    .execute();

  return rows.length;
}

/** Блокирует бронь для вебхука: порядок блокировок booking → payment. */
export function lockBookingForPayment(
  executor: DbExecutor,
  bookingId: string,
): Promise<PaymentBookingRow | undefined> {
  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .innerJoin('users', 'users.id', 'bookings.guest_id')
    .select([
      'bookings.id',
      'bookings.status',
      'bookings.guest_id',
      'bookings.total_minor',
      'bookings.currency',
      'bookings.deposit_due_at',
      'listings.owner_id as listing_owner_id',
      'listings.title as listing_title',
      'bookings.check_in',
      'bookings.check_out',
      'users.display_name as guest_display_name',
    ])
    .where('bookings.id', '=', bookingId)
    .forUpdate('bookings')
    .executeTakeFirst() as Promise<PaymentBookingRow | undefined>;
}

/** Подтверждённые брони с истёкшим сроком депозита и без успешной оплаты. */
export function lockUnpaidDeposits(
  executor: DbExecutor,
  at: Date,
  limit: number,
): Promise<UnpaidBookingRow[]> {
  return executor
    .selectFrom('bookings')
    .innerJoin('listings', 'listings.id', 'bookings.listing_id')
    .innerJoin('users', 'users.id', 'bookings.guest_id')
    .select([
      'bookings.id',
      'bookings.listing_id',
      'bookings.guest_id',
      'bookings.total_minor',
      'bookings.currency',
      'bookings.check_in',
      'bookings.check_out',
      'bookings.deposit_due_at',
      'listings.owner_id as listing_owner_id',
      'listings.title as listing_title',
      'users.display_name as guest_display_name',
    ])
    .where('bookings.status', '=', 'confirmed')
    .where('bookings.deposit_due_at', 'is not', null)
    .where('bookings.deposit_due_at', '<=', at)
    .where(
      sql<boolean>`NOT EXISTS (
        SELECT 1 FROM payments p
        WHERE p.booking_id = bookings.id
          AND p.kind = 'deposit'
          AND p.status IN ('succeeded', 'refunded')
      )`,
    )
    .orderBy('bookings.deposit_due_at', 'asc')
    .limit(limit)
    .forUpdate('bookings')
    .skipLocked()
    .execute() as Promise<UnpaidBookingRow[]>;
}

/** Открытые сессии платежа закрываются, когда депозит отменён или просрочен. */
export async function failOpenDeposits(
  executor: DbExecutor,
  bookingId: string,
  reason: string,
): Promise<number> {
  const rows = await executor
    .updateTable('payments')
    .set({
      status: 'failed',
      raw_event: sql<Json>`coalesce(raw_event, '{}'::jsonb) || ${JSON.stringify({ failedReason: reason })}::jsonb`,
    })
    .where('booking_id', '=', bookingId)
    .where('kind', '=', 'deposit')
    .where('status', '=', 'created')
    .returning('id')
    .execute();

  return rows.length;
}

