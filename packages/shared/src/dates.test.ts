import { describe, expect, it } from 'vitest';
import {
  addDays,
  eachNight,
  isIsoDate,
  isWeekendNight,
  nightsBetween,
  rangesOverlap,
  todayInTimeZone,
  utcToIsoDate,
} from './dates';

describe('dates', () => {
  it('отвергает несуществующие даты', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
  });

  it('переходит через границу месяца и года', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('не сдвигает дату в западных таймзонах', () => {
    expect(utcToIsoDate(new Date(Date.UTC(2026, 6, 10)))).toBe('2026-07-10');
    expect(nightsBetween('2026-07-10', '2026-07-12')).toBe(2);
  });

  it('возвращает ночи полуинтервала [from, to)', () => {
    expect(eachNight('2024-02-28', '2024-03-02')).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });

  it('считает выходными пятницу и субботу', () => {
    expect(isWeekendNight('2026-07-10')).toBe(true);
    expect(isWeekendNight('2026-07-11')).toBe(true);
    expect(isWeekendNight('2026-07-12')).toBe(false);
    expect(isWeekendNight('2026-07-09')).toBe(false);
  });

  it('определяет сегодняшнюю дату по таймзоне объявления', () => {
    const moment = new Date('2026-10-19T22:30:00.000Z');
    expect(todayInTimeZone('Europe/Moscow', moment)).toBe('2026-10-20');
    expect(todayInTimeZone('UTC', moment)).toBe('2026-10-19');
  });

  it('не считает смежные диапазоны пересекающимися', () => {
    expect(rangesOverlap('2026-07-10', '2026-07-12', '2026-07-12', '2026-07-14')).toBe(false);
    expect(rangesOverlap('2026-07-10', '2026-07-13', '2026-07-12', '2026-07-14')).toBe(true);
  });
});
