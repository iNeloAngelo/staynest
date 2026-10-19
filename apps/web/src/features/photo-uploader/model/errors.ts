import { ApiError } from '../../../shared/api';
import type { TranslationKey } from '../../../shared/i18n';

const ERROR_KEYS: Record<string, TranslationKey> = {
  photo_too_large: 'photos.errors.tooLarge',
  photo_unsupported_type: 'photos.errors.unsupported',
  photo_pixels_exceeded: 'photos.errors.pixels',
  photos_limit_reached: 'photos.errors.limit',
  photos_per_upload_limit: 'photos.errors.perUpload',
  photos_too_few_published: 'photos.errors.tooFewPublished',
  photo_upload_rate_limited: 'photos.errors.rateLimited',
  photo_files_required: 'photos.errors.filesRequired',
  photo_order_invalid: 'photos.errors.orderInvalid',
  photo_not_found: 'photos.errors.notFound',
  storage_unavailable: 'photos.errors.storage',
  network_error: 'photos.errors.network',
  upload_aborted: 'photos.errors.network',
  unauthorized: 'photos.errors.unauthorized',
};

export function photoErrorKey(error: unknown): TranslationKey {
  if (error instanceof Error && !(error instanceof ApiError)) {
    if (error.message === 'photo_too_large') return 'photos.errors.tooLarge';
    if (error.message === 'photo_unsupported_type') return 'photos.errors.unsupported';
  }

  if (error instanceof ApiError) {
    return ERROR_KEYS[error.code] ?? 'photos.errors.generic';
  }

  return 'photos.errors.generic';
}
