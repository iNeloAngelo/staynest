import { AppError } from '../../platform/http/errors';

export function photoUnsupported(): AppError {
  return new AppError({
    status: 415,
    code: 'photo_unsupported_type',
    title: 'Unsupported Media Type',
    detail: 'Поддерживаются JPEG, PNG, WebP и AVIF. Тип проверяется по содержимому файла.',
  });
}

export function photoTooLarge(maxBytes: number): AppError {
  return new AppError({
    status: 413,
    code: 'photo_too_large',
    title: 'Payload Too Large',
    detail: `Файл больше ${Math.round(maxBytes / (1024 * 1024))} МБ.`,
  });
}

export function photoPixelsExceeded(): AppError {
  return new AppError({
    status: 422,
    code: 'photo_pixels_exceeded',
    title: 'Unprocessable Entity',
    detail: 'Разрешение изображения слишком велико. Уменьшите фото перед загрузкой.',
  });
}

export function photosLimitReached(max: number): AppError {
  return new AppError({
    status: 422,
    code: 'photos_limit_reached',
    title: 'Unprocessable Entity',
    detail: `У объявления может быть не больше ${max} фото.`,
  });
}

export function photosPerUploadLimit(max: number): AppError {
  return new AppError({
    status: 422,
    code: 'photos_per_upload_limit',
    title: 'Unprocessable Entity',
    detail: `За один раз можно загрузить не больше ${max} фото.`,
  });
}

export function photoUploadRateLimited(): AppError {
  return new AppError({
    status: 429,
    code: 'photo_upload_rate_limited',
    title: 'Too Many Requests',
    detail: 'Слишком много загрузок. Подождите несколько минут.',
    headers: { 'retry-after': '600' },
  });
}

export function photosTooFewPublished(min: number): AppError {
  return new AppError({
    status: 422,
    code: 'photos_too_few_published',
    title: 'Unprocessable Entity',
    detail: `У опубликованного объявления должно оставаться не меньше ${min} фото.`,
  });
}

export function photoFilesRequired(): AppError {
  return new AppError({
    status: 422,
    code: 'photo_files_required',
    title: 'Unprocessable Entity',
    detail: 'Добавьте хотя бы один файл в поле files.',
  });
}

export function photoNotFound(): AppError {
  return new AppError({
    status: 404,
    code: 'photo_not_found',
    title: 'Not Found',
    detail: 'Фото не найдено.',
  });
}

export function photoOrderInvalid(): AppError {
  return new AppError({
    status: 422,
    code: 'photo_order_invalid',
    title: 'Unprocessable Entity',
    detail: 'Порядок должен содержать все фото объявления без повторов.',
  });
}

export function storageUnavailable(): AppError {
  return new AppError({
    status: 503,
    code: 'storage_unavailable',
    title: 'Service Unavailable',
    detail: 'Хранилище изображений временно недоступно. Попробуйте ещё раз.',
  });
}
