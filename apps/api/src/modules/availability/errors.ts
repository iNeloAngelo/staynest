import { AppError } from '../../platform/http/errors';

export function blockNotFound(): AppError {
  return new AppError({
    status: 404,
    code: 'block_not_found',
    title: 'Not Found',
    detail: 'Блокировка не найдена.',
  });
}

export function blockOverlapsBooking(): AppError {
  return new AppError({
    status: 409,
    code: 'block_overlaps_booking',
    title: 'Conflict',
    detail: 'На эти даты есть активная заявка или бронь. Сначала отмените её.',
  });
}

export function blockOverlaps(): AppError {
  return new AppError({
    status: 409,
    code: 'block_overlaps',
    title: 'Conflict',
    detail: 'Эти даты уже заблокированы.',
  });
}

export function blockInPast(): AppError {
  return new AppError({
    status: 422,
    code: 'block_in_past',
    title: 'Unprocessable Entity',
    detail: 'Нельзя заблокировать даты, которые уже прошли.',
  });
}
