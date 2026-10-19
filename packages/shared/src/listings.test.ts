import { describe, expect, it } from 'vitest';
import {
  createListingInputSchema,
  updateListingAmenitiesInputSchema,
  updateListingInputSchema,
} from './listings';

describe('listing contracts', () => {
  it('превращает пустую строку в null и нормализует страну', () => {
    const parsed = updateListingInputSchema.parse({ title: '   ', country: 'ru' });

    expect(parsed).toEqual({ title: null, country: 'RU' });
  });

  it('не принимает название короче 5 символов', () => {
    expect(updateListingInputSchema.safeParse({ title: 'Дом' }).success).toBe(false);
  });

  it('требует хотя бы одно поле при правке', () => {
    expect(updateListingInputSchema.safeParse({}).success).toBe(false);
  });

  it('разрешает создать пустой черновик', () => {
    expect(createListingInputSchema.parse({})).toEqual({});
  });

  it('запрещает повторяющиеся удобства', () => {
    const result = updateListingAmenitiesInputSchema.safeParse({ amenityIds: [1, 1] });

    expect(result.success).toBe(false);
  });
});
