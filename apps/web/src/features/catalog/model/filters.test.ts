import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  effectiveSort,
  filtersToSearchParams,
  hasActiveFilters,
  parseCatalogFilters,
  toggleItem,
} from './filters';

describe('parseCatalogFilters', () => {
  it('читает фильтры из URL и отбрасывает невалидные значения', () => {
    const filters = parseCatalogFilters(
      new URLSearchParams(
        'q=озеро&city=Суздаль&checkIn=2026-12-10&checkOut=2026-12-12&guests=4&priceMin=300000&priceMax=900000&bedroomsMin=2&type=house,villa,palace&amenities=1,3,3,x&sort=price_asc',
      ),
    );

    expect(filters).toEqual({
      q: 'озеро',
      city: 'Суздаль',
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      guests: 4,
      priceMin: 300_000,
      priceMax: 900_000,
      bedroomsMin: 2,
      types: ['house', 'villa'],
      amenities: [1, 3],
      sort: 'price_asc',
    });
  });

  it('читает повторяющиеся type и amenities', () => {
    const filters = parseCatalogFilters(
      new URLSearchParams('type=house&type=villa&amenities=1&amenities=3,4&type=house'),
    );

    expect(filters.types).toEqual(['house', 'villa']);
    expect(filters.amenities).toEqual([1, 3, 4]);
  });

  it('отбрасывает неполный и перевёрнутый диапазон дат', () => {
    expect(parseCatalogFilters(new URLSearchParams('checkIn=2026-12-10')).checkIn).toBeNull();
    expect(
      parseCatalogFilters(new URLSearchParams('checkIn=2026-12-12&checkOut=2026-12-10')),
    ).toMatchObject({ checkIn: null, checkOut: null });
    expect(
      parseCatalogFilters(new URLSearchParams('checkIn=2026-02-30&checkOut=2026-03-02')),
    ).toMatchObject({ checkIn: null, checkOut: null });
    expect(
      parseCatalogFilters(new URLSearchParams('checkIn=2026-01-01&checkOut=2028-01-01')),
    ).toMatchObject({ checkIn: null, checkOut: null });
  });

  it('возвращает пустые фильтры для пустого URL', () => {
    expect(parseCatalogFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });

  it('не принимает отрицательные цены и слишком большие числа гостей', () => {
    const filters = parseCatalogFilters(
      new URLSearchParams('guests=0&priceMin=-1&priceMax=999999999999999&bedroomsMin=100'),
    );

    expect(filters.guests).toBeNull();
    expect(filters.priceMin).toBeNull();
    expect(filters.priceMax).toBeNull();
    expect(filters.bedroomsMin).toBeNull();
  });
});

describe('filtersToSearchParams', () => {
  it('пишет только непустые значения и восстанавливает фильтры без потерь', () => {
    const filters = {
      q: ' озеро ',
      city: 'Суздаль',
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      guests: 2,
      priceMin: 300_000,
      priceMax: null,
      bedroomsMin: 1,
      types: ['house' as const],
      amenities: [1, 2],
      sort: 'price_desc' as const,
    };

    const params = filtersToSearchParams(filters);

    expect(params.toString()).toBe(
      'q=%D0%BE%D0%B7%D0%B5%D1%80%D0%BE&city=%D0%A1%D1%83%D0%B7%D0%B4%D0%B0%D0%BB%D1%8C&checkIn=2026-12-10&checkOut=2026-12-12&guests=2&priceMin=300000&bedroomsMin=1&type=house&amenities=1%2C2&sort=price_desc',
    );
    expect(parseCatalogFilters(params)).toMatchObject({ ...filters, q: 'озеро' });
  });

  it('даёт пустую строку для пустых фильтров', () => {
    expect(filtersToSearchParams(EMPTY_FILTERS).toString()).toBe('');
  });
});

describe('effectiveSort', () => {
  it('включает релевантность только при текстовом запросе', () => {
    expect(effectiveSort(EMPTY_FILTERS)).toBe('newest');
    expect(effectiveSort({ ...EMPTY_FILTERS, q: 'озеро' })).toBe('relevance');
    expect(effectiveSort({ ...EMPTY_FILTERS, sort: 'relevance' })).toBe('newest');
    expect(effectiveSort({ ...EMPTY_FILTERS, q: 'озеро', sort: 'price_asc' })).toBe('price_asc');
  });
});

describe('hasActiveFilters', () => {
  it('не считает пустые значения активными', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, city: 'Суздаль' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, amenities: [1] })).toBe(true);
    expect(
      hasActiveFilters({ ...EMPTY_FILTERS, checkIn: '2026-12-10', checkOut: '2026-12-12' }),
    ).toBe(true);
  });
});

describe('toggleItem', () => {
  it('добавляет и убирает значение', () => {
    expect(toggleItem([1], 2)).toEqual([1, 2]);
    expect(toggleItem([1, 2], 1)).toEqual([2]);
  });
});
