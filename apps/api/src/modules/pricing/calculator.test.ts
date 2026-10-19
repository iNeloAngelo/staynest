import { describe, expect, it } from 'vitest';
import { calculateQuote } from './calculator';
import type { PricingListing, PricingRule, QuoteInput } from './calculator';

const LISTING: PricingListing = {
  maxGuests: 4,
  basePriceMinor: 100_000,
  weekendPriceMinor: null,
  cleaningFeeMinor: 50_000,
  minNights: 1,
  maxNights: 30,
  currency: 'RUB',
};

const RULES: PricingRule[] = [];

function rule(overrides: Partial<PricingRule> = {}): PricingRule {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Лето',
    dateFrom: '2026-07-01',
    dateTo: '2026-08-31',
    nightlyPriceMinor: 200_000,
    minNights: null,
    priority: 0,
    ...overrides,
  };
}

function input(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    checkIn: '2026-07-10',
    checkOut: '2026-07-12',
    guests: 2,
    today: '2026-07-01',
    listing: LISTING,
    rules: RULES,
    unavailable: [],
    ...overrides,
  };
}

function total(result: ReturnType<typeof calculateQuote>): number {
  if (!result.ok) throw new Error(`Ожидался расчёт, получено ${result.code}`);
  return result.quote.totalMinor;
}

describe('pricing: базовая цена и выходные', () => {
  it('считает будние ночи по базовой цене', () => {
    const result = calculateQuote(input({ checkIn: '2026-07-13', checkOut: '2026-07-15' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.nightly.map((night) => night.priceMinor)).toEqual([100_000, 100_000]);
    expect(result.quote.nights).toBe(2);
  });

  it('применяет цену выходных к ночи с пятницы на субботу', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-10',
        checkOut: '2026-07-11',
        listing: { ...LISTING, weekendPriceMinor: 150_000 },
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly[0]).toMatchObject({ source: 'weekend', priceMinor: 150_000 });
  });

  it('применяет цену выходных к ночи с субботы на воскресенье', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-11',
        checkOut: '2026-07-12',
        listing: { ...LISTING, weekendPriceMinor: 150_000 },
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly[0]).toMatchObject({ source: 'weekend', priceMinor: 150_000 });
  });

  it('не считает воскресную ночь выходной', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-12',
        checkOut: '2026-07-13',
        listing: { ...LISTING, weekendPriceMinor: 150_000 },
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly[0]).toMatchObject({ source: 'base', priceMinor: 100_000 });
  });

  it('без заданной цены выходных использует базовую', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-10',
        checkOut: '2026-07-12',
        listing: { ...LISTING, weekendPriceMinor: null },
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly.every((night) => night.source === 'base')).toBe(true);
  });
});

describe('pricing: сезонные правила и приоритеты', () => {
  it('сезонное правило важнее цены выходных', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-10',
        checkOut: '2026-07-11',
        listing: { ...LISTING, weekendPriceMinor: 150_000 },
        rules: [rule({ nightlyPriceMinor: 300_000 })],
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly[0]).toMatchObject({ source: 'seasonal', priceMinor: 300_000 });
  });

  it('выбирает правило с наибольшим приоритетом', () => {
    const result = calculateQuote(
      input({
        rules: [
          rule({ id: 'low', priority: 1, nightlyPriceMinor: 200_000 }),
          rule({ id: 'high', priority: 10, nightlyPriceMinor: 400_000 }),
        ],
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly.every((night) => night.priceMinor === 400_000)).toBe(true);
    expect(result.quote.nightly[0]?.ruleId).toBe('high');
  });

  it('при равном приоритете выигрывает более поздняя дата начала', () => {
    const result = calculateQuote(
      input({
        rules: [
          rule({ id: 'early', dateFrom: '2026-07-01', nightlyPriceMinor: 200_000 }),
          rule({ id: 'late', dateFrom: '2026-07-05', nightlyPriceMinor: 350_000 }),
        ],
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly[0]).toMatchObject({ ruleId: 'late', priceMinor: 350_000 });
  });

  it('при полном совпадении периода выбирает правило с меньшим id', () => {
    const result = calculateQuote(
      input({
        rules: [
          rule({ id: 'bbbb', nightlyPriceMinor: 350_000 }),
          rule({ id: 'aaaa', nightlyPriceMinor: 250_000 }),
        ],
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly[0]).toMatchObject({ ruleId: 'aaaa', priceMinor: 250_000 });
  });

  it('включает границы сезонного периода', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-01',
        checkOut: '2026-09-01',
        today: '2026-06-01',
        listing: { ...LISTING, maxNights: 365 },
        rules: [rule({ dateFrom: '2026-07-01', dateTo: '2026-08-31' })],
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly[0]?.source).toBe('seasonal');
    expect(result.quote.nightly.at(-1)).toMatchObject({ date: '2026-08-31', source: 'seasonal' });
  });

  it('не применяет правило вне периода', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-06-29',
        checkOut: '2026-07-01',
        today: '2026-06-01',
        rules: [rule()],
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly.every((night) => night.source === 'base')).toBe(true);
  });

  it('не смешивает низкоприоритетное правило с высокоприоритетным', () => {
    const result = calculateQuote(
      input({
        rules: [
          rule({ id: 'low', priority: 1, nightlyPriceMinor: 200_000 }),
          rule({ id: 'high', dateFrom: '2026-07-11', dateTo: '2026-07-11', priority: 5 }),
        ],
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nightly.map((night) => night.ruleId)).toEqual(['low', 'high']);
  });
});

describe('pricing: сроки и гости', () => {
  it('требует минимальный срок объявления', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-13',
        checkOut: '2026-07-14',
        listing: { ...LISTING, minNights: 2 },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('min_nights_not_met');
    expect(result.issues[0]?.minNights).toBe(2);
  });

  it('берёт минимальный срок из сезонного правила', () => {
    const result = calculateQuote(
      input({ checkIn: '2026-07-13', checkOut: '2026-07-15', rules: [rule({ minNights: 5 })] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.minNights).toBe(5);
  });

  it('берёт максимум из применимых правил', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-10',
        checkOut: '2026-07-12',
        rules: [rule({ id: 'a', minNights: 2 }), rule({ id: 'b', minNights: 4, priority: 1 })],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.minNights).toBe(4);
  });

  it('не применяет min nights правила, проигравшего цену', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-10',
        checkOut: '2026-07-12',
        rules: [
          rule({ id: 'low', priority: 1, minNights: 5, nightlyPriceMinor: 200_000 }),
          rule({ id: 'high', priority: 10, minNights: null, nightlyPriceMinor: 300_000 }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.minNightsApplied).toBe(1);
  });

  it('отклоняет срок больше максимального', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-01',
        checkOut: '2026-08-01',
        listing: { ...LISTING, maxNights: 30 },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('max_nights_exceeded');
  });

  it('отклоняет гостей больше вместимости', () => {
    const result = calculateQuote(input({ guests: 5 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('guests_exceed_capacity');
  });
});

describe('pricing: даты и доступность', () => {
  it('отклоняет выезд раньше заезда', () => {
    const result = calculateQuote(input({ checkIn: '2026-07-12', checkOut: '2026-07-10' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('invalid_date_range');
  });

  it('отклоняет нулевой срок', () => {
    const result = calculateQuote(input({ checkIn: '2026-07-10', checkOut: '2026-07-10' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('invalid_date_range');
  });

  it('отклоняет прошедшую дату заезда', () => {
    const result = calculateQuote(
      input({ checkIn: '2026-07-01', checkOut: '2026-07-03', today: '2026-07-02' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('stay_in_past');
  });

  it('разрешает заезд сегодня', () => {
    const result = calculateQuote(
      input({ checkIn: '2026-07-02', checkOut: '2026-07-04', today: '2026-07-02' }),
    );
    expect(result.ok).toBe(true);
  });

  it('отклоняет занятую ночь', () => {
    const result = calculateQuote(input({ unavailable: [{ date: '2026-07-11', kind: 'booked' }] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('dates_unavailable');
    expect(result.status).toBe(409);
  });

  it('отклоняет заблокированную ночь', () => {
    const result = calculateQuote(
      input({ unavailable: [{ date: '2026-07-11', kind: 'blocked' }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('dates_unavailable');
  });

  it('разрешает заезд в день выезда предыдущего гостя', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-12',
        checkOut: '2026-07-14',
        unavailable: [
          { date: '2026-07-10', kind: 'booked' },
          { date: '2026-07-11', kind: 'booked' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('pricing: разбивка и итог', () => {
  it('добавляет уборку один раз', () => {
    const result = calculateQuote(input());
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.cleaningFeeMinor).toBe(50_000);
    expect(result.quote.nightlyTotalMinor).toBe(200_000);
    expect(result.quote.totalMinor).toBe(250_000);
  });

  it('сервисный сбор в MVP равен нулю', () => {
    const result = calculateQuote(input());
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.serviceFeeMinor).toBe(0);
  });

  it('группирует соседние ночи с одинаковой ценой', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-10',
        checkOut: '2026-07-14',
        listing: { ...LISTING, weekendPriceMinor: 150_000 },
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.groups).toHaveLength(2);
    expect(result.quote.groups[0]).toMatchObject({ nights: 2, priceMinor: 150_000 });
    expect(result.quote.groups[1]).toMatchObject({ nights: 2, priceMinor: 100_000 });
  });

  it('не склеивает базовые и выходные ночи с одинаковой ценой', () => {
    const result = calculateQuote(
      input({
        checkIn: '2026-07-10',
        checkOut: '2026-07-14',
        listing: { ...LISTING, weekendPriceMinor: 100_000 },
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.groups).toHaveLength(2);
    expect(result.quote.groups.map((group) => group.source)).toEqual(['weekend', 'base']);
  });

  it('считает високосный февраль', () => {
    const result = calculateQuote(
      input({
        checkIn: '2024-02-28',
        checkOut: '2024-03-02',
        today: '2024-01-01',
      }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nights).toBe(3);
    expect(result.quote.nightly.map((night) => night.date)).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });

  it('переходит через границу месяца', () => {
    const result = calculateQuote(
      input({ checkIn: '2026-01-30', checkOut: '2026-02-02', today: '2026-01-01' }),
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nights).toBe(3);
    expect(total(result)).toBe(350_000);
  });

  it('считает одну ночь', () => {
    const result = calculateQuote(input({ checkIn: '2026-07-13', checkOut: '2026-07-14' }));
    if (!result.ok) throw new Error(result.code);
    expect(result.quote.nights).toBe(1);
    expect(result.quote.totalMinor).toBe(150_000);
  });

  it('возвращает выбранные даты и число гостей', () => {
    const result = calculateQuote(input({ guests: 3 }));
    if (!result.ok) throw new Error(result.code);
    expect(result.quote).toMatchObject({
      checkIn: '2026-07-10',
      checkOut: '2026-07-12',
      guests: 3,
      currency: 'RUB',
    });
  });
});
