const LOCALES = { ru: 'ru-RU', en: 'en-US' } as const;

function localeTag(locale: string): string {
  return locale === 'en' ? LOCALES.en : LOCALES.ru;
}

export function formatMoney(minor: number, locale: string, currency = 'RUB'): string {
  const hasFraction = minor % 100 !== 0;

  return new Intl.NumberFormat(localeTag(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(minor / 100);
}

export function minorToInput(minor: number | null): string {
  if (minor === null) return '';
  return String(minor / 100);
}

export function inputToMinor(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed * 100);
}

export function inputToInteger(value: string): number | null {
  const normalized = value.trim();
  if (normalized === '') return null;

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) return null;

  return parsed;
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}
