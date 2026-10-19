import { AppError } from '../../platform/http/errors';
import type { QuoteFailure } from './calculator';

export function priceRuleNotFound(): AppError {
  return new AppError({
    status: 404,
    code: 'price_rule_not_found',
    title: 'Not Found',
    detail: 'Сезонное правило не найдено.',
  });
}

export function priceRuleNightsTooLong(maxNights: number): AppError {
  return new AppError({
    status: 422,
    code: 'validation_error',
    title: 'Unprocessable Entity',
    detail: `Минимальный срок правила не может быть больше максимального срока объявления (${maxNights} ночей).`,
    errors: [
      {
        path: 'minNights',
        code: 'min_nights_exceeds_listing',
        message: `Минимальный срок правила не может быть больше ${maxNights} ночей.`,
      },
    ],
  });
}

export function quoteRejected(failure: QuoteFailure): AppError {
  return new AppError({
    status: failure.status,
    code: failure.code,
    title: failure.status === 409 ? 'Conflict' : 'Unprocessable Entity',
    detail: failure.issues[0]?.message ?? 'Не удалось рассчитать стоимость.',
    errors: failure.issues,
  });
}
