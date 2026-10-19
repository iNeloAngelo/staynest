/**
 * Даты проживания — всегда строки `YYYY-MM-DD` без времени и таймзоны.
 * Здесь нет `new Date('2026-07-10')`: такая запись парсится как UTC-полночь
 * и в западных таймзонах даёт предыдущий день. Арифметика идёт по UTC-полю
 * календаря, но наружу всегда возвращается строка.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isoDateToUtc(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

export function utcToIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(value: string, days: number): string {
  const date = isoDateToUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToIsoDate(date);
}

export function compareIsoDates(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Ночь — это дата её начала: проживание `[from, to)` занимает `from … to-1`. */
export function eachNight(from: string, to: string): string[] {
  const nights: string[] = [];

  for (let current = from; current < to; current = addDays(current, 1)) {
    nights.push(current);
  }

  return nights;
}

export function nightsBetween(from: string, to: string): number {
  const diff = isoDateToUtc(to).getTime() - isoDateToUtc(from).getTime();
  return Math.round(diff / MS_PER_DAY);
}

/** Выходные по ТЗ: ночь с пятницы на субботу и с субботы на воскресенье. */
export function isWeekendNight(value: string): boolean {
  const day = isoDateToUtc(value).getUTCDay();
  return day === 5 || day === 6;
}

/** Сегодняшняя дата в таймзоне объявления, а не в таймзоне браузера или сервера. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const pick = (type: 'year' | 'month' | 'day'): string =>
    parts.find((part) => part.type === type)?.value ?? '01';

  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/** Пересечение полуинтервалов `[from, to)`. Смежные диапазоны не пересекаются. */
export function rangesOverlap(
  leftFrom: string,
  leftTo: string,
  rightFrom: string,
  rightTo: string,
): boolean {
  return leftFrom < rightTo && rightFrom < leftTo;
}
