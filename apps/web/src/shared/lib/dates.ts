const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Дата без времени в локальном календаре браузера: полдень защищает от DST. */
export function parseIsoDateLocal(value: string): Date {
  const match = ISO_DATE.exec(value);
  if (!match) return new Date(Number.NaN);

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

export function formatIsoDateLocal(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayLocalIso(): string {
  return formatIsoDateLocal(new Date());
}

export function formatLongDate(value: string, language: string): string {
  return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseIsoDateLocal(value));
}

export function formatShortDate(value: string, language: string): string {
  return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(parseIsoDateLocal(value));
}

/** Дата и время события: используется в таймлайне и сроках ответа. */
export function formatDateTime(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Месяц графика `YYYY-MM`: короткое название без дня и года. */
export function formatMonth(value: string, language: string): string {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, 1, 12);

  return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-US' : 'ru-RU', {
    month: 'short',
  }).format(date);
}
