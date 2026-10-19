import { describe, expect, it } from 'vitest';
import { catalogQuerySchema, citySuggestionsQuerySchema } from './catalog';

describe('catalogQuerySchema', () => {
  it('приводит строки запроса к числам и массивам', () => {
    const parsed = catalogQuerySchema.parse({
      q: '  озеро  ',
      guests: '4',
      priceMin: '100000',
      priceMax: '900000',
      bedroomsMin: '2',
      type: 'house,villa',
      amenities: ['1', '3'],
      sort: 'price_asc',
      limit: '12',
    });

    expect(parsed).toMatchObject({
      q: 'озеро',
      guests: 4,
      priceMin: 100_000,
      priceMax: 900_000,
      bedroomsMin: 2,
      type: ['house', 'villa'],
      amenities: [1, 3],
      sort: 'price_asc',
      limit: 12,
    });
  });

  it('применяет лимит по умолчанию и убирает пустой текст', () => {
    const parsed = catalogQuerySchema.parse({ q: '   ', city: '' });

    expect(parsed.q).toBeUndefined();
    expect(parsed.city).toBeUndefined();
    expect(parsed.limit).toBe(24);
  });

  it('принимает snake_case и имена массивов из ТЗ', () => {
    const parsed = catalogQuerySchema.parse({
      price_min: '500000',
      price_max: '900000',
      bedrooms_min: '2',
      'type[]': ['house', 'villa'],
      'amenities[]': ['1', '3'],
    });

    expect(parsed).toMatchObject({
      priceMin: 500_000,
      priceMax: 900_000,
      bedroomsMin: 2,
      type: ['house', 'villa'],
      amenities: [1, 3],
    });
  });

  it('убирает повторяющиеся type и amenities', () => {
    const parsed = catalogQuerySchema.parse({
      type: ['house', 'house'],
      amenities: ['1', '1', '2'],
    });

    expect(parsed.type).toEqual(['house']);
    expect(parsed.amenities).toEqual([1, 2]);
  });

  it('принимает даты в camelCase и snake_case', () => {
    expect(
      catalogQuerySchema.parse({ checkIn: '2026-12-10', checkOut: '2026-12-12' }),
    ).toMatchObject({ checkIn: '2026-12-10', checkOut: '2026-12-12' });

    expect(
      catalogQuerySchema.parse({ check_in: '2026-12-10', check_out: '2026-12-12' }),
    ).toMatchObject({ checkIn: '2026-12-10', checkOut: '2026-12-12' });
  });

  it('требует обе даты и правильный порядок', () => {
    expect(() => catalogQuerySchema.parse({ checkIn: '2026-12-10' })).toThrow();
    expect(() =>
      catalogQuerySchema.parse({ checkIn: '2026-12-12', checkOut: '2026-12-10' }),
    ).toThrow();
    expect(() =>
      catalogQuerySchema.parse({ checkIn: '2026-02-30', checkOut: '2026-03-02' }),
    ).toThrow();
    expect(() =>
      catalogQuerySchema.parse({ checkIn: '2026-01-01', checkOut: '2028-01-01' }),
    ).toThrow();
  });

  it('отвергает amenity id вне smallint', () => {
    expect(() => catalogQuerySchema.parse({ amenities: '99999' })).toThrow();
  });

  it('отвергает неизвестный тип жилья и слишком большой лимит', () => {
    expect(() => catalogQuerySchema.parse({ type: 'palace' })).toThrow();
    expect(() => catalogQuerySchema.parse({ limit: '1000' })).toThrow();
    expect(() => catalogQuerySchema.parse({ guests: '0' })).toThrow();
  });
});

describe('citySuggestionsQuerySchema', () => {
  it('ограничивает число подсказок', () => {
    expect(citySuggestionsQuerySchema.parse({})).toEqual({ limit: 8 });
    expect(() => citySuggestionsQuerySchema.parse({ limit: 50 })).toThrow();
  });
});
