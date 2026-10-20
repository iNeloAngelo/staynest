import type {
  DepositPaymentResponse,
  MockPaymentWebhook,
  PaymentWebhookResponse,
} from '@staynest/shared';
import type { DbExecutor } from '../../../platform/db/index';
import type { BookingEventPayload } from '../../../platform/events/index';
import type { Json } from '../../../platform/db/schema.generated';
import { bookingNotFound } from '../errors';
import { insertBookingEvent, lockBookingForActor, updateBookingStatus } from '../repo';
import type { PaymentRuntime } from './context';
import {
  depositAlreadyPaid,
  depositExpired,
  depositUnavailable,
  paymentForbidden,
  paymentNotFound,
  paymentWebhookConflict,
} from './errors';
import { toPaymentDto } from './mapping';
import { createMockSessionId, mockPaymentUrl } from './provider';
import {
  failOpenDeposits,
  findPaymentByExternalId,
  insertDeposit,
  listDeposits,
  lockBookingForPayment,
  lockPaymentById,
  lockUnpaidDeposits,
  setPaymentSession,
  updatePaymentStatus,
} from './repo';
import type { PaymentBookingRow, PaymentRow, UnpaidBookingRow } from './repo';

/** Процент от суммы, вверх до копейки. Ноль или выключенный депозит → null. */
export function depositAmountMinor(totalMinor: number, percent: number): number | null {
  if (percent <= 0 || totalMinor <= 0) return null;
  return Math.max(1, Math.ceil((totalMinor * percent) / 100));
}

export function depositDueAt(ttlHours: number, now: Date): Date {
  return new Date(now.getTime() + ttlHours * 3_600_000);
}

/** Вызывается внутри транзакции подтверждения: бронь и депозит коммитятся вместе. */
export async function createDepositForConfirmed(
  executor: DbExecutor,
  input: { bookingId: string; totalMinor: number; currency: string; percent: number },
): Promise<PaymentRow | null> {
  const amountMinor = depositAmountMinor(input.totalMinor, input.percent);
  if (amountMinor === null) return null;

  return insertDeposit(executor, {
    bookingId: input.bookingId,
    amountMinor,
    currency: input.currency.trim(),
  });
}

function latestDeposit(deposits: PaymentRow[]): PaymentRow | undefined {
  return deposits.at(-1);
}

function sessionResponse(payment: PaymentRow): DepositPaymentResponse {
  if (!payment.external_id) throw paymentNotFound();
  return { payment: toPaymentDto(payment), payUrl: mockPaymentUrl(payment.external_id) };
}

function expiryPayload(row: UnpaidBookingRow, at: Date): BookingEventPayload {
  return {
    bookingId: row.id,
    listingId: row.listing_id,
    guestId: row.guest_id,
    hostId: row.listing_owner_id,
    status: 'expired',
    occurredAt: at.toISOString(),
    listingTitle: row.listing_title,
    checkIn: row.check_in ?? '',
    checkOut: row.check_out ?? '',
    guestName: row.guest_display_name,
    totalMinor: Number(row.total_minor),
    currency: row.currency.trim(),
    expiresAt: row.deposit_due_at.toISOString(),
  };
}

function assertDepositCanStart(
  booking: Awaited<ReturnType<typeof lockBookingForActor>>,
  actorId: string,
  now: Date,
): asserts booking is NonNullable<typeof booking> {
  if (!booking) throw bookingNotFound();
  if (booking.guest_id !== actorId) throw paymentForbidden();
  if (booking.status !== 'confirmed' || booking.deposit_due_at === null) {
    throw depositUnavailable();
  }
  if (booking.deposit_due_at.getTime() <= now.getTime()) throw depositExpired();
}

function existingSession(current: PaymentRow | undefined): DepositPaymentResponse | null {
  if (!current) return null;
  if (current.status === 'succeeded' || current.status === 'refunded') {
    throw depositAlreadyPaid();
  }
  if (current.status === 'created' && current.external_id) return sessionResponse(current);
  return null;
}

async function startDeposit(
  runtime: PaymentRuntime,
  actorId: string,
  bookingId: string,
): Promise<DepositPaymentResponse> {
  const now = runtime.now();

  return runtime.db.kysely.transaction().execute(async (trx) => {
    const booking = await lockBookingForActor(trx, bookingId, actorId);
    assertDepositCanStart(booking, actorId, now);

    const current = latestDeposit(await listDeposits(trx, bookingId));
    const reusable = existingSession(current);
    if (reusable) return reusable;

    const created =
      current?.status === 'created'
        ? current
        : await createDepositForConfirmed(trx, {
            bookingId,
            totalMinor: Number(booking.total_minor),
            currency: booking.currency,
            percent: runtime.config.payments.depositPercent,
          });
    if (!created) throw depositUnavailable();

    const withSession = await setPaymentSession(trx, created.id, createMockSessionId());
    return sessionResponse(withSession);
  });
}

function bookingActive(status: string): boolean {
  return status === 'confirmed' || status === 'completed';
}

function depositLate(dueAt: Date | null, now: Date): boolean {
  return dueAt !== null && dueAt.getTime() <= now.getTime();
}

function paymentOutcome(booking: PaymentBookingRow, now: Date): 'succeeded' | 'refunded' {
  const active = bookingActive(booking.status);
  return active && !depositLate(booking.deposit_due_at, now) ? 'succeeded' : 'refunded';
}

function alreadyProcessed(payment: PaymentRow, event: MockPaymentWebhook): boolean {
  if (event.status === 'failed') return payment.status === 'failed';
  return payment.status === 'succeeded' || payment.status === 'refunded';
}

function amountsMatch(payment: PaymentRow, event: MockPaymentWebhook): boolean {
  return (
    Number(payment.amount_minor) === event.amountMinor &&
    payment.currency.trim() === event.currency
  );
}

type ApplyEventInput = {
  trx: DbExecutor;
  payment: PaymentRow;
  booking: PaymentBookingRow;
  event: MockPaymentWebhook;
  now: Date;
};

async function applyEvent(input: ApplyEventInput): Promise<PaymentWebhookResponse> {
  const { trx, payment, booking, event, now } = input;
  const rawEvent = event as unknown as Json;

  if (event.status === 'failed') {
    await updatePaymentStatus(trx, payment.id, 'failed', rawEvent);
    return { received: true, replayed: false };
  }

  await updatePaymentStatus(trx, payment.id, paymentOutcome(booking, now), rawEvent);
  return { received: true, replayed: false };
}

async function handleWebhook(
  runtime: PaymentRuntime,
  event: MockPaymentWebhook,
): Promise<PaymentWebhookResponse> {
  return runtime.db.kysely.transaction().execute(async (trx) => {
    // Порядок блокировок booking → payment совпадает с джобом просрочки.
    const known = await findPaymentByExternalId(trx, event.externalId);
    if (!known) throw paymentNotFound();

    const booking = await lockBookingForPayment(trx, known.booking_id);
    if (!booking) throw paymentNotFound();

    const payment = await lockPaymentById(trx, known.id);
    if (!payment) throw paymentNotFound();

    if (!amountsMatch(payment, event)) throw paymentWebhookConflict();

    if (payment.status !== 'created') {
      if (alreadyProcessed(payment, event)) return { received: true, replayed: true };
      // Поздний успех после отмены: провайдер всё же списал деньги, фиксируем
      // возврат, даже если отмена уже успела закрыть сессию.
      if (event.status === 'succeeded') {
        await updatePaymentStatus(trx, payment.id, paymentOutcome(booking, runtime.now()), event as unknown as Json);
        return { received: true, replayed: false };
      }
      throw paymentWebhookConflict();
    }

    return applyEvent({ trx, payment, booking, event, now: runtime.now() });
  });
}

/** Просроченный депозит отменяет бронь. Возвращает события для публикации после коммита. */
async function expireUnpaid(
  runtime: PaymentRuntime,
  at: Date = runtime.now(),
): Promise<BookingEventPayload[]> {
  return runtime.db.kysely.transaction().execute(async (trx) => {
    const rows = await lockUnpaidDeposits(trx, at, 100);
    const payloads: BookingEventPayload[] = [];

    for (const row of rows) {
      await updateBookingStatus(trx, row.id, 'expired', {
        cancelled_at: at,
        cancel_reason: null,
      });
      await insertBookingEvent(trx, {
        bookingId: row.id,
        actorId: null,
        fromStatus: 'confirmed',
        toStatus: 'expired',
        note: 'deposit_due_at',
      });
      await failOpenDeposits(trx, row.id, 'deposit_expired');
      payloads.push(expiryPayload(row, at));
    }

    return payloads;
  });
}

export function createDepositService(runtime: PaymentRuntime) {
  return {
    start: (actorId: string, bookingId: string) => startDeposit(runtime, actorId, bookingId),
    handleWebhook: (event: MockPaymentWebhook) => handleWebhook(runtime, event),
    expireUnpaid: (at?: Date) => expireUnpaid(runtime, at),
  };
}
