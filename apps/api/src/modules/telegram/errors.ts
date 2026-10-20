import { AppError } from '../../platform/http/errors';

export class TelegramInitDataError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'TelegramInitDataError';
  }
}

export function telegramNotConfigured(): AppError {
  return new AppError({
    status: 503,
    code: 'telegram_disabled',
    title: 'Service Unavailable',
    detail: 'Вход через Telegram не настроен на этом сервере.',
  });
}

export function invalidInitData(): AppError {
  return new AppError({
    status: 401,
    code: 'invalid_init_data',
    title: 'Unauthorized',
    detail: 'Не удалось подтвердить данные Telegram. Откройте приложение из бота заново.',
  });
}

export function invalidWebhookSecret(): AppError {
  return new AppError({
    status: 401,
    code: 'invalid_webhook_secret',
    title: 'Unauthorized',
    detail: 'Неверный секрет вебхука.',
  });
}

export function telegramRateLimited(retryAfterSeconds: number): AppError {
  return new AppError({
    status: 429,
    code: 'rate_limited',
    title: 'Too Many Requests',
    detail: 'Слишком много попыток входа. Попробуйте позже.',
    headers: { 'retry-after': String(retryAfterSeconds) },
  });
}

export function telegramAccountInactive(): AppError {
  return new AppError({
    status: 403,
    code: 'account_inactive',
    title: 'Forbidden',
    detail: 'Аккаунт заблокирован или удалён.',
  });
}
