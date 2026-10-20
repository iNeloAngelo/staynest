import { AppError } from '../../platform/http/errors';

export function invalidFavoritesCursor(): AppError {
  return new AppError({
    status: 400,
    code: 'invalid_cursor',
    title: 'Bad Request',
    detail: 'Курсор избранного недействителен. Откройте список заново.',
  });
}
