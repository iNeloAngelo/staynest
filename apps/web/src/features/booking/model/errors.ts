import type { TFunction } from 'i18next';
import { ApiError } from '../../../shared/api';
import type { TranslationKey } from '../../../shared/i18n';

const ERROR_KEYS: Record<string, TranslationKey> = {
  booking_dates_unavailable: 'booking.errors.datesUnavailable',
  invalid_booking_transition: 'booking.errors.invalidTransition',
  booking_not_found: 'booking.errors.notFound',
  booking_action_forbidden: 'booking.errors.forbidden',
  booking_own_listing: 'booking.errors.ownListing',
  too_many_pending_bookings: 'booking.errors.tooManyPending',
  booking_rate_limited: 'booking.errors.rateLimited',
  email_not_verified: 'booking.errors.emailNotVerified',
  cancellation_window_closed: 'booking.errors.cancellationClosed',
  host_cancel_reason_required: 'booking.errors.hostReasonRequired',
  idempotency_key_conflict: 'booking.errors.idempotencyConflict',
  network_error: 'booking.errors.network',
  unauthorized: 'booking.errors.unauthorized',
  deposit_unavailable: 'booking.errors.depositUnavailable',
  deposit_already_paid: 'booking.errors.depositAlreadyPaid',
  deposit_expired: 'booking.errors.depositExpired',
  payment_forbidden: 'booking.errors.paymentForbidden',
  payment_not_found: 'booking.errors.paymentNotFound',
};

export function bookingErrorText(error: unknown, t: TFunction): string {
  if (!(error instanceof ApiError)) return t('booking.errors.generic');
  const key = ERROR_KEYS[error.code];
  return key ? t(key) : t('booking.errors.generic');
}

export function isDatesUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'booking_dates_unavailable';
}
