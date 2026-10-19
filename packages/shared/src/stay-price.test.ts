import { describe, expect, it } from 'vitest';
import { calculateStayPrice, choosePriceRule, priceNights } from './stay-price';
import type { StayPriceRule } from './stay-price';

const LISTING = {
  basePriceMinor: 100_000,
  weekendPriceMinor: 150_000,
  cleaningFeeMinor: 50_000,
  currency: 'RUB',
};

function rule(overrides: Partial<StayPriceRule> = {}): StayPriceRule {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    dateFrom: '2026-07-01',
    dateTo: '2026-07-31',
    nightlyPriceMinor: 200_000,
    priority: 0,
    ...overrides,
  };
}

describe('choosePriceRule', () => {
  it('выбирает правило с большим приоритетом', () => {
    const low = rule({ nightlyPriceMinor: 150_000 });
    const high = rule({ id: '22222222-2222-4222-8222-222222222222', priority: 5 });

    expect(choosePriceRule('2026-07-10', [low, high])?.nightlyPriceMinor).toBe(200_000);
  });

  it('при равном приоритете выбирает более поздний период, затем меньший id', () => {
    const early = rule({ dateFrom: '2026-07-01' });
    const late = rule({
      id: '33333333-3333-4333-8333-333333333333',
      dateFrom: '2026-07-05',
      nightlyPriceMinor: 300_000,
    });
    const samePeriod = rule({
      id: '00000000-0000-4000-8000-000000000000',
      dateFrom: '2026-07-05',
      nightlyPriceMinor: 400_000,
    });

    expect(choosePriceRule('2026-07-10', [early, late])?.nightlyPriceMinor).toBe(300_000);
    expect(choosePriceRule('2026-07-10', [late, samePeriod])?.nightlyPriceMinor).toBe(400_000);
  });

  it('не выбирает правило вне периода', () => {
    expect(choosePriceRule('2026-08-01', [rule()])).toBeNull();
  });
});

describe('priceNights', () => {
  it('применяет сезон, выходные и базовую цену', () => {
    const nights = priceNights('2026-07-09', '2026-07-13', LISTING, [
      rule({ dateFrom: '2026-07-10', dateTo: '2026-07-10' }),
    ]);

    expect(nights).toEqual([
      { date: '2026-07-09', priceMinor: 100_000, source: 'base', rule: null },
      { date: '2026-07-10', priceMinor: 200_000, source: 'seasonal', rule: expect.anything() },
      { date: '2026-07-11', priceMinor: 150_000, source: 'weekend', rule: null },
      { date: '2026-07-12', priceMinor: 100_000, source: 'base', rule: null },
    ]);
  });

  it('не считает выходной без заданной цены выходных', () => {
    const nights = priceNights(
      '2026-07-11',
      '2026-07-12',
      { ...LISTING, weekendPriceMinor: null },
      [],
    );

    expect(nights[0]).toMatchObject({ priceMinor: 100_000, source: 'base' });
  });
});

describe('calculateStayPrice', () => {
  it('суммирует ночи и добавляет уборку один раз', () => {
    const stay = calculateStayPrice({
      checkIn: '2026-07-09',
      checkOut: '2026-07-13',
      listing: LISTING,
      rules: [rule({ dateFrom: '2026-07-10', dateTo: '2026-07-10' })],
    });

    expect(stay).toEqual({
      checkIn: '2026-07-09',
      checkOut: '2026-07-13',
      nights: 4,
      nightlyTotalMinor: 550_000,
      cleaningFeeMinor: 50_000,
      totalMinor: 600_000,
      currency: 'RUB',
    });
  });
});
