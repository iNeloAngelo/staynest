import type { ListingPublishIssue } from '@staynest/shared';
import { AppError } from '../../platform/http/errors';

export function listingNotFound(): AppError {
  return new AppError({
    status: 404,
    code: 'listing_not_found',
    title: 'Not Found',
    detail: 'Объявление не найдено.',
  });
}

export function listingNotDraft(): AppError {
  return new AppError({
    status: 409,
    code: 'listing_not_draft',
    title: 'Conflict',
    detail: 'Удалить можно только черновик.',
  });
}

export function listingNotPublished(): AppError {
  return new AppError({
    status: 409,
    code: 'listing_not_published',
    title: 'Conflict',
    detail: 'Архивировать можно только опубликованное объявление.',
  });
}

export function listingAlreadyPublished(): AppError {
  return new AppError({
    status: 409,
    code: 'listing_already_published',
    title: 'Conflict',
    detail: 'Объявление уже опубликовано.',
  });
}

export function listingHasActiveBookings(): AppError {
  return new AppError({
    status: 409,
    code: 'listing_has_active_bookings',
    title: 'Conflict',
    detail: 'Нельзя архивировать объявление с активными будущими бронями.',
  });
}

export function listingIncomplete(issues: ListingPublishIssue[]): AppError {
  return new AppError({
    status: 422,
    code: 'listing_incomplete',
    title: 'Unprocessable Entity',
    detail: 'Заполните обязательные поля, чтобы опубликовать объявление.',
    errors: issues,
  });
}

/** Страховка от нарушения CHECK в БД: наружу отдаём 422, а не 500. */
export function listingInvalid(): AppError {
  return new AppError({
    status: 422,
    code: 'listing_incomplete',
    title: 'Unprocessable Entity',
    detail: 'Проверьте обязательные поля объявления.',
  });
}

export function invalidNightsRange(): AppError {
  return new AppError({
    status: 422,
    code: 'validation_error',
    title: 'Unprocessable Entity',
    detail: 'Максимальный срок не может быть меньше минимального.',
    errors: [
      {
        path: 'maxNights',
        code: 'invalid_range',
        message: 'Максимальный срок не может быть меньше минимального.',
      },
    ],
  });
}

export function amenityNotFound(ids: number[]): AppError {
  return new AppError({
    status: 422,
    code: 'validation_error',
    title: 'Unprocessable Entity',
    detail: 'Одно или несколько удобств не найдены.',
    errors: [{ path: 'amenityIds', code: 'unknown_amenity', message: ids.join(', ') }],
  });
}

export function publishingRequiresVerifiedEmail(): AppError {
  return new AppError({
    status: 403,
    code: 'email_not_verified',
    title: 'Forbidden',
    detail: 'Подтвердите email, чтобы публиковать объявления.',
  });
}
