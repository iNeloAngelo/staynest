import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMe } from '../../auth';
import { useOnline } from '../../../shared/lib/useOnline';
import { useCreateBooking } from '../api/bookings-hooks';
import { newIdempotencyKey } from '../api/bookings';
import { bookingErrorText, isDatesUnavailable } from './errors';
import type { IsoRange } from './selection';

function useStableKey(payload: string): string {
  const ref = useRef({ payload, key: newIdempotencyKey() });

  if (ref.current.payload !== payload) {
    ref.current = { payload, key: newIdempotencyKey() };
  }

  return ref.current.key;
}

function payloadOf(input: {
  listingId: string;
  range: IsoRange | undefined;
  guests: number;
  message: string;
}): string {
  return [
    input.listingId,
    input.range?.from ?? '',
    input.range?.to ?? '',
    input.guests,
    input.message.trim(),
  ].join('|');
}

function bookingInputOf(
  input: { listingId: string; guests: number; message: string },
  range: IsoRange,
) {
  return {
    listingId: input.listingId,
    checkIn: range.from,
    checkOut: range.to ?? range.from,
    guestsCount: input.guests,
    ...(input.message.trim() ? { guestMessage: input.message.trim() } : {}),
  };
}

export function useBookingRequest(input: {
  listingId: string;
  range: IsoRange | undefined;
  guests: number;
  message: string;
  ready: boolean;
  onDatesUnavailable: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnline();
  const { data: user } = useMe();
  const create = useCreateBooking();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const payload = payloadOf(input);
  const key = useStableKey(payload);

  async function submit(): Promise<void> {
    if (!online) return;

    if (!user) {
      const next = `${location.pathname}${location.search}`;
      navigate(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (!input.range?.from || !input.range.to || !input.ready) return;

    setError(null);
    setConflict(false);

    try {
      const booking = await create.mutateAsync({
        key,
        input: bookingInputOf(input, input.range),
      });
      navigate(`/bookings/${booking.id}?created=1`);
    } catch (requestError) {
      setError(bookingErrorText(requestError, t));
      const datesTaken = isDatesUnavailable(requestError);
      setConflict(datesTaken);
      if (datesTaken) input.onDatesUnavailable();
    }
  }

  return {
    submit: () => void submit(),
    pending: create.isPending,
    error,
    conflict,
    online,
    authenticated: Boolean(user),
    clearError: () => {
      setError(null);
      setConflict(false);
    },
  };
}
