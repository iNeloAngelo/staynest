import type { BookingStatus } from '@staynest/shared';
import { AppError } from '../../platform/http/errors';
import { isExclusionViolation } from '../../platform/db/errors';

export function bookingDatesUnavailable(): AppError {
  return new AppError({
    status: 409,
    code: 'booking_dates_unavailable',
    title: 'Conflict',
    detail: 'Эти даты уже заняты. Выберите другие даты.',
    errors: [
      {
        path: 'checkIn',
        code: 'booking_dates_unavailable',
        message: 'Эти даты уже заняты. Выберите другие даты.',
      },
    ],
  });
}

/** Страховка от гонки: `INSERT` нарушил exclusion constraint. */
export function mapBookingInsertError(error: unknown): AppError | null {
  return isExclusionViolation(error) ? bookingDatesUnavailable() : null;
}

export function bookingNotFound(): AppError {
  return new AppError({
    status: 404,
    code: 'booking_not_found',
    title: 'Not Found',
    detail: 'Бронирование не найдено.',
  });
}

export function bookingActionForbidden(): AppError {
  return new AppError({
    status: 403,
    code: 'booking_action_forbidden',
    title: 'Forbidden',
    detail: 'Это действие доступно только хозяину объявления.',
  });
}

export function invalidBookingTransition(from: BookingStatus, action: string): AppError {
  return new AppError({
    status: 409,
    code: 'invalid_booking_transition',
    title: 'Conflict',
    detail: `Действие «${action}» недоступно из статуса «${from}».`,
    errors: [{ path: 'status', code: 'invalid_booking_transition', from, action }],
  });
}

export function bookingOwnListing(): AppError {
  return new AppError({
    status: 422,
    code: 'booking_own_listing',
    title: 'Unprocessable Entity',
    detail: 'Нельзя бронировать собственное объявление.',
    errors: [
      {
        path: 'listingId',
        code: 'booking_own_listing',
        message: 'Нельзя бронировать собственное объявление.',
      },
    ],
  });
}

export function bookingRequiresVerifiedEmail(): AppError {
  return new AppError({
    status: 403,
    code: 'email_not_verified',
    title: 'Forbidden',
    detail: 'Подтвердите email, чтобы бронировать.',
  });
}

export function cancellationWindowClosed(): AppError {
  return new AppError({
    status: 422,
    code: 'cancellation_window_closed',
    title: 'Unprocessable Entity',
    detail: 'Гость может отменить подтверждённую бронь только до даты заезда.',
    errors: [
      {
        path: 'status',
        code: 'cancellation_window_closed',
        message: 'Отмена после заезда недоступна.',
      },
    ],
  });
}

export function hostCancelReasonRequired(): AppError {
  return new AppError({
    status: 422,
    code: 'host_cancel_reason_required',
    title: 'Unprocessable Entity',
    detail: 'Хозяин отменяет подтверждённую бронь только с причиной.',
    errors: [
      {
        path: 'reason',
        code: 'host_cancel_reason_required',
        message: 'Укажите причину отмены.',
      },
    ],
  });
}

export function tooManyPendingBookings(max: number): AppError {
  return new AppError({
    status: 429,
    code: 'too_many_pending_bookings',
    title: 'Too Many Requests',
    detail: `У вас уже ${max} заявок в ожидании ответа. Дождитесь ответа хозяина.`,
  });
}

export function bookingRateLimited(retryAfterSeconds: number): AppError {
  return new AppError({
    status: 429,
    code: 'booking_rate_limited',
    title: 'Too Many Requests',
    detail: 'Слишком много заявок. Попробуйте позже.',
    headers: { 'retry-after': String(retryAfterSeconds) },
  });
}

export function idempotencyKeyRequired(): AppError {
  return new AppError({
    status: 400,
    code: 'idempotency_key_required',
    title: 'Bad Request',
    detail: 'Для создания брони нужен заголовок Idempotency-Key.',
  });
}

export function invalidIdempotencyKey(): AppError {
  return new AppError({
    status: 422,
    code: 'invalid_idempotency_key',
    title: 'Unprocessable Entity',
    detail: 'Idempotency-Key должен содержать 8–200 символов: латиница, цифры, . _ : -',
  });
}

export function idempotencyKeyConflict(): AppError {
  return new AppError({
    status: 422,
    code: 'idempotency_key_conflict',
    title: 'Unprocessable Entity',
    detail: 'Этот Idempotency-Key уже использован с другим телом запроса.',
  });
}

export function invalidBookingCursor(): AppError {
  return new AppError({
    status: 400,
    code: 'invalid_cursor',
    title: 'Bad Request',
    detail: 'Курсор пагинации некорректен.',
  });
}
