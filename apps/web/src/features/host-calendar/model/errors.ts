import type { TFunction } from 'i18next';
import { ApiError } from '../../../shared/api';
import type { TranslationKey } from '../../../shared/i18n';

const ERROR_KEYS: Record<string, TranslationKey> = {
  block_overlaps_booking: 'hostCalendar.errors.block_overlaps_booking',
  block_overlaps: 'hostCalendar.errors.block_overlaps',
  block_in_past: 'hostCalendar.errors.block_in_past',
  block_not_found: 'hostCalendar.errors.block_not_found',
  price_rule_not_found: 'hostCalendar.errors.price_rule_not_found',
  validation_error: 'hostCalendar.errors.validation_error',
  network_error: 'hostCalendar.errors.network_error',
};

export function hostErrorText(
  error: unknown,
  t: TFunction,
  fallback: TranslationKey = 'hostCalendar.errors.generic',
): string {
  if (!(error instanceof ApiError)) return t(fallback);

  const key = ERROR_KEYS[error.code];
  return key ? t(key) : t(fallback);
}
