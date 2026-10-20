import { AppError } from '../../platform/http/errors';

export function invalidNotificationCursor(): AppError {
  return new AppError({
    status: 400,
    code: 'invalid_cursor',
    title: 'Invalid cursor',
    detail: 'Курсор уведомлений повреждён.',
  });
}

export function pushNotConfigured(): AppError {
  return new AppError({
    status: 503,
    code: 'push_not_configured',
    title: 'Push is not configured',
    detail: 'Web Push на сервере не настроен: нет VAPID-ключей.',
  });
}

export function pushHostNotAllowed(): AppError {
  return new AppError({
    status: 422,
    code: 'push_host_not_allowed',
    title: 'Push endpoint is not supported',
    detail: 'Этот push-сервис не поддерживается.',
  });
}

export function pushRateLimited(retryAfterSeconds: number): AppError {
  return new AppError({
    status: 429,
    code: 'rate_limited',
    title: 'Too many requests',
    detail: 'Слишком много попыток подписки на уведомления.',
    headers: { 'retry-after': String(Math.max(1, retryAfterSeconds)) },
  });
}

export function tooManyEventStreams(limit: number): AppError {
  return new AppError({
    status: 429,
    code: 'too_many_event_streams',
    title: 'Too many event streams',
    detail: `Одновременно можно держать не больше ${limit} потоков событий.`,
  });
}
