import { describe, expect, it } from 'vitest';
import { demoListing } from '../../../test/api-mocks';
import { fromListing, toUpdateInput } from './form';

describe('listing form', () => {
  it('переносит объявление в строки формы и обратно', () => {
    const state = fromListing({
      ...demoListing,
      title: 'Дом у озера',
      city: 'Суздаль',
      maxGuests: 4,
      basePriceMinor: 750_000,
      cleaningFeeMinor: 150_000,
      amenities: [
        { id: 1, code: 'wifi', nameRu: 'Wi-Fi', nameEn: 'Wi-Fi', icon: 'wifi', sortOrder: 1 },
      ],
    });

    expect(state.basePrice).toBe('7500');
    expect(state.cleaningFee).toBe('1500');
    expect(state.maxGuests).toBe('4');
    expect(state.amenityIds).toEqual([1]);

    const { input, issues } = toUpdateInput(state);
    expect(issues).toEqual([]);
    expect(input.title).toBe('Дом у озера');
    expect(input.basePriceMinor).toBe(750_000);
    expect(input.cleaningFeeMinor).toBe(150_000);
    expect(input.maxGuests).toBe(4);
  });

  it('пустые числовые поля остаются null, а не превращаются в ноль', () => {
    const { input, issues } = toUpdateInput(fromListing(demoListing));

    expect(issues).toEqual([]);
    expect(input.title).toBeNull();
    expect(input.maxGuests).toBeNull();
    expect(input.bedrooms).toBeNull();
    expect(input.basePriceMinor).toBeNull();
    expect(input.cleaningFeeMinor).toBe(0);
  });

  it('переводит рубли в копейки с округлением', () => {
    const state = { ...fromListing(demoListing), basePrice: '7500.5' };
    const { input } = toUpdateInput(state);

    expect(input.basePriceMinor).toBe(750_050);
  });

  it('сообщает о цене ниже нуля и перевёрнутом диапазоне ночей', () => {
    const state = {
      ...fromListing(demoListing),
      basePrice: '0',
      minNights: '7',
      maxNights: '3',
    };
    const { issues } = toUpdateInput(state);

    expect(issues).toEqual(
      expect.arrayContaining([
        { field: 'basePrice', code: 'invalid_price' },
        { field: 'maxNights', code: 'invalid_range' },
      ]),
    );
  });

  it('считает emoji как один символ и не пропускает короткое название', () => {
    const state = { ...fromListing(demoListing), title: '🏠🏠🏠' };
    const { issues } = toUpdateInput(state);

    expect(issues).toContainEqual({ field: 'title', code: 'title_too_short' });
  });

  it('не пропускает цену выше потолка денежных полей', () => {
    const state = { ...fromListing(demoListing), basePrice: '999999999999' };
    const { issues } = toUpdateInput(state);

    expect(issues).toContainEqual({ field: 'basePrice', code: 'invalid_price' });
  });
});
