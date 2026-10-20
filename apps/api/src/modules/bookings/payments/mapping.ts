import type { BookingDeposit, PaymentDto, PaymentKind, PaymentStatus } from '@staynest/shared';
import type { PaymentRow } from './repo';

export function depositOf(dueAt: Date | null, deposits: PaymentRow[]): BookingDeposit | null {
  if (dueAt === null) return null;
  const latest = deposits.at(-1);
  if (!latest) return null;

  const status = latest.status as PaymentStatus;
  const paid = status === 'succeeded';

  return {
    status,
    amountMinor: Number(latest.amount_minor),
    currency: latest.currency.trim(),
    dueAt: dueAt.toISOString(),
    paidAt: paid ? latest.updated_at.toISOString() : null,
    refundedAt: status === 'refunded' ? latest.updated_at.toISOString() : null,
  };
}

export function toPaymentDto(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    bookingId: row.booking_id,
    provider: row.provider,
    kind: row.kind as PaymentKind,
    status: row.status as PaymentStatus,
    amountMinor: Number(row.amount_minor),
    currency: row.currency.trim(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
