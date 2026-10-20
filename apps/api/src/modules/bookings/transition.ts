import type { BookingResponse, BookingStatus } from '@staynest/shared';
import type { Updateable } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';
import type { Bookings } from '../../platform/db/schema.generated';
import type { BookingRuntime } from './context';
import { todayOf } from './context';
import {
  bookingActionForbidden,
  bookingNotFound,
  cancellationWindowClosed,
  hostCancelReasonRequired,
  invalidBookingTransition,
} from './errors';
import type { BookingEventPayload } from '../../platform/events/index';
import { toBookingDetail } from './mapping';
import {
  findBookingById,
  insertBookingEvent,
  listBookingEvents,
  lockBookingForActor,
  updateBookingStatus,
} from './repo';
import { resolveTransition, transitionRequiresReason } from './state-machine';
import type { BookingAction, BookingActorRole } from './state-machine';

type TransitionInput = {
  comment?: string;
  reason?: string;
};

type TransitionOutcome =
  | { kind: 'action'; body: BookingResponse; payload: BookingEventPayload; action: BookingAction }
  | { kind: 'expired'; payload: BookingEventPayload };

function actorRole(row: { guest_id: string }, actorId: string): BookingActorRole {
  return row.guest_id === actorId ? 'guest' : 'host';
}

function assertActionAllowed(action: BookingAction, role: BookingActorRole): void {
  if ((action === 'confirm' || action === 'decline') && role !== 'host') {
    throw bookingActionForbidden();
  }
}

type PatchContext = {
  action: BookingAction;
  target: BookingStatus;
  actorId: string;
  input: TransitionInput;
  now: Date;
};

function patchFor(context: PatchContext): Updateable<Bookings> {
  const { action, target, actorId, input, now } = context;
  if (action === 'confirm') return { expires_at: null, confirmed_at: now };
  if (action === 'decline') return { host_response: input.comment ?? null };
  if (transitionRequiresReason(target) && !input.reason) throw hostCancelReasonRequired();

  return {
    cancelled_at: now,
    cancelled_by: actorId,
    cancel_reason: input.reason ?? null,
  };
}

function noteFor(action: BookingAction, input: TransitionInput): string | null {
  if (action === 'decline') return input.comment ?? null;
  if (action === 'cancel') return input.reason ?? null;
  return null;
}

type CancelWindowContext = {
  action: BookingAction;
  role: BookingActorRole;
  from: BookingStatus;
  checkIn: string;
  today: string;
};

function assertCancelWindow(context: CancelWindowContext): void {
  if (context.action !== 'cancel' || context.role !== 'guest' || context.from !== 'confirmed') {
    return;
  }
  if (context.today >= context.checkIn) throw cancellationWindowClosed();
}

export type BookingActionRequest = {
  actorId: string;
  bookingId: string;
  action: BookingAction;
  input?: TransitionInput;
};

type ExpireContext = {
  trx: DbExecutor;
  row: Awaited<ReturnType<typeof lockBookingForActor>>;
  bookingId: string;
  now: Date;
};

async function expireIfStale(context: ExpireContext): Promise<TransitionOutcome | null> {
  const { trx, row, bookingId, now } = context;
  if (
    !row ||
    row.status !== 'pending' ||
    row.expires_at === null ||
    row.expires_at.getTime() > now.getTime()
  ) {
    return null;
  }

  // Pending с истёкшим TTL нельзя ни подтвердить, ни отклонить, ни отменить:
  // джоб может отставать или быть выключен, поэтому истечение применяется
  // здесь же, под той же блокировкой строки.
  await updateBookingStatus(trx, bookingId, 'expired', {});
  await insertBookingEvent(trx, {
    bookingId,
    actorId: null,
    fromStatus: 'pending',
    toStatus: 'expired',
    note: 'expires_at',
  });

  return {
    kind: 'expired',
    payload: {
      bookingId,
      listingId: row.listing_id,
      guestId: row.guest_id,
      hostId: row.listing_owner_id,
      status: 'expired',
      occurredAt: now.toISOString(),
      listingTitle: row.listing_title,
      checkIn: row.check_in ?? '',
      checkOut: row.check_out ?? '',
      guestName: row.guest_display_name,
      totalMinor: Number(row.total_minor),
      currency: row.currency.trim(),
      ...(row.expires_at ? { expiresAt: row.expires_at.toISOString() } : {}),
    },
  };
}

type ApplyContext = {
  trx: DbExecutor;
  runtime: BookingRuntime;
  request: BookingActionRequest;
  row: NonNullable<ExpireContext['row']>;
  now: Date;
};

async function applyOnLockedRow(context: ApplyContext): Promise<TransitionOutcome> {
  const { trx, runtime, request, row, now } = context;
  const { actorId, bookingId, action, input = {} } = request;
  const role = actorRole(row, actorId);
  const target = resolveTransition(action, row.status, role);
  assertActionAllowed(action, role);
  if (target === null) throw invalidBookingTransition(row.status, action);

  assertCancelWindow({
    action,
    role,
    from: row.status,
    checkIn: row.check_in ?? '',
    today: todayOf(runtime),
  });

  await updateBookingStatus(
    trx,
    bookingId,
    target,
    patchFor({ action, target, actorId, input, now }),
  );
  await insertBookingEvent(trx, {
    bookingId,
    actorId,
    fromStatus: row.status,
    toStatus: target,
    note: noteFor(action, input),
  });

  const updated = await findBookingById(trx, bookingId);
  if (!updated) throw new Error('Обновлённая бронь не найдена');

  return {
    kind: 'action',
    body: {
      booking: toBookingDetail(
        updated,
        await listBookingEvents(trx, bookingId),
        runtime.config.storage.publicPath,
        actorId,
      ),
    },
    payload: {
      bookingId,
      listingId: row.listing_id,
      guestId: row.guest_id,
      hostId: row.listing_owner_id,
      status: target,
      occurredAt: now.toISOString(),
      listingTitle: row.listing_title,
      checkIn: row.check_in ?? '',
      checkOut: row.check_out ?? '',
      guestName: row.guest_display_name,
      totalMinor: Number(row.total_minor),
      currency: row.currency.trim(),
      ...(row.expires_at ? { expiresAt: row.expires_at.toISOString() } : {}),
    },
    action,
  };
}

async function transitionInTransaction(
  trx: DbExecutor,
  runtime: BookingRuntime,
  request: BookingActionRequest,
  now: Date,
): Promise<TransitionOutcome> {
  const row = await lockBookingForActor(trx, request.bookingId, request.actorId);
  if (!row) throw bookingNotFound();

  const expired = await expireIfStale({
    trx,
    row,
    bookingId: request.bookingId,
    now,
  });
  if (expired) return expired;

  return applyOnLockedRow({ trx, runtime, request, row, now });
}

export async function applyBookingAction(
  runtime: BookingRuntime,
  request: BookingActionRequest,
): Promise<BookingResponse> {
  const now = runtime.now();
  const outcome = await runtime.db.kysely
    .transaction()
    .execute((trx) => transitionInTransaction(trx, runtime, request, now));

  if (outcome.kind === 'expired') {
    runtime.events.publish('booking.expired', outcome.payload);
    throw invalidBookingTransition('expired', request.action);
  }

  const payload = outcome.payload;
  if (outcome.action === 'confirm') runtime.events.publish('booking.confirmed', payload);
  if (outcome.action === 'decline') runtime.events.publish('booking.declined', payload);
  if (outcome.action === 'cancel') {
    runtime.events.publish('booking.cancelled', { ...payload, actorId: request.actorId });
  }

  return outcome.body;
}
