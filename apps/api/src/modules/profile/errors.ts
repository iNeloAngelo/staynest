import { AVATAR_MAX_BYTES } from '@staynest/shared';
import { AppError } from '../../platform/http/errors';

export function avatarRequired(): AppError {
  return new AppError({
    status: 422,
    code: 'avatar_required',
    title: 'Unprocessable Entity',
    detail: 'Прикрепите файл аватара в поле avatar.',
  });
}

export function avatarTooLarge(): AppError {
  return new AppError({
    status: 422,
    code: 'avatar_too_large',
    title: 'Unprocessable Entity',
    detail: `Файл аватара больше ${Math.floor(AVATAR_MAX_BYTES / 1024 / 1024)} МБ или превышает лимит пикселей.`,
  });
}

export function avatarUnsupported(): AppError {
  return new AppError({
    status: 415,
    code: 'avatar_unsupported',
    title: 'Unsupported Media Type',
    detail: 'Поддерживаются JPEG, PNG, WebP и AVIF.',
  });
}

export function avatarRateLimited(retryAfterSeconds: number): AppError {
  return new AppError({
    status: 429,
    code: 'avatar_rate_limited',
    title: 'Too Many Requests',
    detail: 'Слишком много загрузок аватара. Попробуйте позже.',
    headers: { 'retry-after': String(retryAfterSeconds) },
  });
}

export function avatarStorageUnavailable(): AppError {
  return new AppError({
    status: 503,
    code: 'storage_unavailable',
    title: 'Service Unavailable',
    detail: 'Хранилище временно недоступно. Попробуйте ещё раз.',
  });
}
