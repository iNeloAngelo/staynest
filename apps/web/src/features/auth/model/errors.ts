import type { TranslationKey } from '../../../shared/i18n';
import { ApiError } from '../../../shared/api';

const ERROR_KEYS: Record<string, TranslationKey> = {
  invalid_credentials: 'auth.errors.invalid_credentials',
  email_not_verified: 'auth.errors.email_not_verified',
  rate_limited: 'auth.errors.rate_limited',
  weak_password: 'auth.errors.weak_password',
  validation_error: 'auth.errors.validation_error',
  unauthorized: 'auth.errors.unauthorized',
  network_error: 'auth.errors.network_error',
  internal_error: 'auth.errors.internal_error',
  invalid_token: 'auth.errors.invalid_token',
  invalid_link_token: 'auth.errors.invalid_link_token',
  origin_not_allowed: 'auth.errors.origin_not_allowed',
};

export function authErrorKey(error: unknown): TranslationKey {
  if (error instanceof ApiError) {
    return ERROR_KEYS[error.code] ?? 'auth.errors.generic';
  }

  return 'auth.errors.generic';
}
