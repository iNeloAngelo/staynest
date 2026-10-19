import { AppError } from '../../platform/http/errors';

export function catalogListingNotFound(): AppError {
  return new AppError({
    status: 404,
    code: 'listing_not_found',
    title: 'Not Found',
    detail: 'Объявление не найдено.',
  });
}

export function invalidCursor(): AppError {
  return new AppError({
    status: 400,
    code: 'invalid_cursor',
    title: 'Bad Request',
    detail: 'Курсор пагинации недействителен. Начните поиск заново.',
  });
}
