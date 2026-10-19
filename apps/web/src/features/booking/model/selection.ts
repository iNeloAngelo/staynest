import type { CalendarResponse } from '@staynest/shared';
import { eachNight, nightsBetween } from '@staynest/shared';

export type IsoRange = { from: string; to?: string };
export type RangeNotice = 'busy_start' | 'range_blocked' | 'past';

export type RangeSelection = {
  range: IsoRange | undefined;
  notice: RangeNotice | null;
};

export type SelectionContext = {
  unavailable: ReadonlySet<string>;
  today: string;
};

export function unavailableSet(
  calendar: Pick<CalendarResponse, 'unavailable'> | undefined,
): ReadonlySet<string> {
  return new Set((calendar?.unavailable ?? []).map((night) => night.date));
}

export function rangeNights(range: IsoRange | undefined): number {
  if (!range?.from || !range.to) return 0;
  return Math.max(0, nightsBetween(range.from, range.to));
}

export function rangeProblem(
  range: IsoRange | undefined,
  calendar: Pick<CalendarResponse, 'minNights' | 'maxNights'> | undefined,
): 'incomplete' | 'min_nights' | 'max_nights' | 'ok' {
  if (!range?.from || !range.to) return 'incomplete';
  const nights = rangeNights(range);

  if (calendar && nights < calendar.minNights) return 'min_nights';
  if (calendar && nights > calendar.maxNights) return 'max_nights';
  return 'ok';
}

/**
 * Выбор диапазона не даёт «перепрыгнуть» занятую ночь: если между началом и
 * кликом есть занятая ночь, выбор начинается заново с кликнутой даты.
 * День выезда может совпадать с занятой ночью: она в диапазон не входит.
 */
export function selectRange(
  current: IsoRange | undefined,
  clicked: string,
  context: SelectionContext,
): RangeSelection {
  if (clicked < context.today) return { range: current, notice: 'past' };

  const starting = !current?.from || Boolean(current.to) || clicked <= current.from;
  if (starting) {
    return context.unavailable.has(clicked)
      ? { range: current, notice: 'busy_start' }
      : { range: { from: clicked }, notice: null };
  }

  const nights = eachNight(current.from, clicked);
  if (nights.some((night) => context.unavailable.has(night))) {
    // Клик по занятой ночи не может быть ни выездом, ни новым началом.
    if (context.unavailable.has(clicked)) return { range: current, notice: 'busy_start' };
    return { range: { from: clicked }, notice: 'range_blocked' };
  }

  return { range: { from: current.from, to: clicked }, notice: null };
}

export function rangeIsQuoteable(
  range: IsoRange | undefined,
  calendar: Pick<CalendarResponse, 'minNights' | 'maxNights'> | undefined,
): boolean {
  return rangeProblem(range, calendar) === 'ok';
}
