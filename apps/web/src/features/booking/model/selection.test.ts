import { describe, expect, it } from 'vitest';
import {
  rangeIsQuoteable,
  rangeNights,
  rangeProblem,
  selectRange,
  unavailableSet,
} from './selection';
import type { SelectionContext } from './selection';

const CONTEXT: SelectionContext = {
  unavailable: new Set(['2026-07-11', '2026-07-15']),
  today: '2026-07-01',
};

describe('выбор диапазона календаря', () => {
  it('первый клик задаёт начало', () => {
    expect(selectRange(undefined, '2026-07-10', CONTEXT)).toEqual({
      range: { from: '2026-07-10' },
      notice: null,
    });
  });

  it('второй клик завершает диапазон', () => {
    const result = selectRange({ from: '2026-07-12' }, '2026-07-14', CONTEXT);
    expect(result.range).toEqual({ from: '2026-07-12', to: '2026-07-14' });
    expect(rangeNights(result.range)).toBe(2);
  });

  it('разрешает выезд в день, занятый следующим гостем', () => {
    const result = selectRange({ from: '2026-07-10' }, '2026-07-11', CONTEXT);
    expect(result.range).toEqual({ from: '2026-07-10', to: '2026-07-11' });
  });

  it('не даёт выбрать диапазон через занятую ночь', () => {
    const result = selectRange({ from: '2026-07-10' }, '2026-07-13', CONTEXT);
    expect(result.range).toEqual({ from: '2026-07-13' });
    expect(result.notice).toBe('range_blocked');
  });

  it('не начинает диапазон с занятой ночи', () => {
    const result = selectRange(undefined, '2026-07-11', CONTEXT);
    expect(result.range).toBeUndefined();
    expect(result.notice).toBe('busy_start');
  });

  it('не даёт начать диапазон в прошлом', () => {
    const result = selectRange(undefined, '2026-06-30', CONTEXT);
    expect(result.range).toBeUndefined();
    expect(result.notice).toBe('past');
  });

  it('клик раньше начала переносит начало', () => {
    const result = selectRange({ from: '2026-07-10' }, '2026-07-08', CONTEXT);
    expect(result.range).toEqual({ from: '2026-07-08' });
  });

  it('клик по завершённому диапазону начинает новый', () => {
    const result = selectRange({ from: '2026-07-10', to: '2026-07-12' }, '2026-07-20', CONTEXT);
    expect(result.range).toEqual({ from: '2026-07-20' });
  });

  it('не разрешает диапазон короче минимального срока', () => {
    expect(
      rangeProblem({ from: '2026-07-10', to: '2026-07-11' }, { minNights: 2, maxNights: 30 }),
    ).toBe('min_nights');
    expect(
      rangeIsQuoteable({ from: '2026-07-10', to: '2026-07-11' }, { minNights: 2, maxNights: 30 }),
    ).toBe(false);
  });

  it('не разрешает диапазон длиннее максимального', () => {
    expect(
      rangeProblem({ from: '2026-07-01', to: '2026-07-05' }, { minNights: 1, maxNights: 3 }),
    ).toBe('max_nights');
  });

  it('считает незавершённый диапазон неквотируемым', () => {
    expect(rangeProblem({ from: '2026-07-10' }, { minNights: 1, maxNights: 30 })).toBe(
      'incomplete',
    );
  });

  it('собирает множество занятых ночей', () => {
    expect(
      unavailableSet({
        unavailable: [
          { date: '2026-07-10', kind: 'booked' },
          { date: '2026-07-11', kind: 'blocked' },
        ],
      }),
    ).toEqual(new Set(['2026-07-10', '2026-07-11']));
  });
});
