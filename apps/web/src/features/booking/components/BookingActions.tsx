import type { BookingStatus } from '@staynest/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../../shared/lib/useOnline';
import { todayLocalIso } from '../../../shared/lib/dates';
import { Button, useToast } from '../../../shared/ui';
import { useCancelBooking, useConfirmBooking, useDeclineBooking } from '../api/bookings-hooks';
import { bookingErrorText } from '../model/errors';
import { canGuestCancel, canHostCancel, canHostDecide } from '../model/status';
import { BookingActionDialog } from './BookingActionDialog';
import type { BookingActionKind } from './BookingActionDialog';

type ActionTarget = { id: string; status: BookingStatus; checkIn: string };

const SUCCESS_KEYS = {
  confirm: 'booking.toast.confirmed',
  decline: 'booking.toast.declined',
  'cancel-guest': 'booking.toast.cancelledGuest',
  'cancel-host': 'booking.toast.cancelledHost',
} as const;

function ActionButtons({
  booking,
  role,
  online,
  onStart,
}: {
  booking: ActionTarget;
  role: 'guest' | 'host';
  online: boolean;
  onStart: (kind: BookingActionKind) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {role === 'host' && canHostDecide(booking.status) ? (
          <>
            <Button onClick={() => onStart('confirm')} disabled={!online}>
              {t('booking.actions.confirm')}
            </Button>
            <Button variant="secondary" onClick={() => onStart('decline')} disabled={!online}>
              {t('booking.actions.decline')}
            </Button>
          </>
        ) : null}

        {role === 'host' && canHostCancel(booking.status) ? (
          <Button variant="danger" onClick={() => onStart('cancel-host')} disabled={!online}>
            {t('booking.actions.cancelHost')}
          </Button>
        ) : null}

        {role === 'guest' && canGuestCancel(booking.status, booking.checkIn, todayLocalIso()) ? (
          <Button variant="secondary" onClick={() => onStart('cancel-guest')} disabled={!online}>
            {booking.status === 'pending'
              ? t('booking.actions.cancelGuest')
              : t('booking.actions.cancelConfirmed')}
          </Button>
        ) : null}
      </div>

      {!online ? (
        <p role="status" className="text-caption text-ink-muted">
          {t('booking.actions.offline')}
        </p>
      ) : null}
    </>
  );
}

export function BookingActions({
  booking,
  role,
}: {
  booking: ActionTarget;
  role: 'guest' | 'host';
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const [kind, setKind] = useState<BookingActionKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = useConfirmBooking();
  const decline = useDeclineBooking();
  const cancel = useCancelBooking();

  function close(): void {
    setKind(null);
    setError(null);
  }

  function done(action: BookingActionKind): void {
    toast.show({ title: t(SUCCESS_KEYS[action]), tone: 'success' });
    close();
  }

  function fail(actionError: unknown): void {
    setError(bookingErrorText(actionError, t));
  }

  function submit(value: { comment?: string; reason?: string }): void {
    if (!kind) return;
    setError(null);

    if (kind === 'confirm') {
      confirm.mutate(booking.id, { onSuccess: () => done(kind), onError: fail });
    } else if (kind === 'decline') {
      decline.mutate(
        { id: booking.id, input: { comment: value.comment } },
        { onSuccess: () => done(kind), onError: fail },
      );
    } else {
      const input = kind === 'cancel-host' ? { reason: value.reason } : {};
      cancel.mutate({ id: booking.id, input }, { onSuccess: () => done(kind), onError: fail });
    }
  }

  const saving = confirm.isPending || decline.isPending || cancel.isPending;

  return (
    <>
      <ActionButtons booking={booking} role={role} online={online} onStart={setKind} />
      <BookingActionDialog
        open={kind !== null}
        kind={kind ?? 'confirm'}
        saving={saving}
        serverError={error}
        onClose={close}
        onSubmit={submit}
      />
    </>
  );
}
