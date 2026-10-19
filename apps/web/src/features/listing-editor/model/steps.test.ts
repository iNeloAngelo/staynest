import { describe, expect, it } from 'vitest';
import { completeListing, demoListing } from '../../../test/api-mocks';
import { fromListing } from './form';
import { LAST_STEP, allStepIssues, fieldStep, firstIncompleteStep, stepIssues } from './steps';

describe('wizard steps', () => {
  it('полное объявление проходит все шаги и открывается на предпросмотре', () => {
    const state = fromListing(completeListing);

    for (let step = 0; step <= LAST_STEP; step += 1) {
      expect(stepIssues(step, state, completeListing.photos.length)).toEqual([]);
    }

    expect(firstIncompleteStep(state, completeListing.photos.length)).toBe(LAST_STEP);
  });

  it('пустой черновик начинается с первого шага', () => {
    const state = fromListing(demoListing);

    expect(stepIssues(0, state, 0)).toEqual(
      expect.arrayContaining([
        { field: 'title', code: 'title_required' },
        { field: 'description', code: 'description_too_short' },
      ]),
    );
    expect(firstIncompleteStep(state, 0)).toBe(0);
  });

  it('не пропускает дальше без города, адреса и вместимости', () => {
    const state = fromListing({
      ...completeListing,
      city: null,
      addressLine: null,
      maxGuests: null,
      bedrooms: null,
      beds: null,
    });

    expect(stepIssues(1, state, 3)).toEqual(
      expect.arrayContaining([
        { field: 'city', code: 'city_required' },
        { field: 'addressLine', code: 'address_required' },
      ]),
    );
    expect(stepIssues(2, state, 3)).toEqual(
      expect.arrayContaining([
        { field: 'maxGuests', code: 'max_guests_required' },
        { field: 'bedrooms', code: 'bedrooms_required' },
        { field: 'beds', code: 'beds_required' },
      ]),
    );
  });

  it('требует три фото и цену для публикации', () => {
    const state = fromListing({ ...completeListing, basePriceMinor: null });

    expect(stepIssues(3, state, 2)).toContainEqual({ field: 'photos', code: 'photos_too_few' });
    expect(stepIssues(4, state, 3)).toContainEqual({
      field: 'basePrice',
      code: 'base_price_required',
    });
  });

  it('проверяет формат времени и диапазон ночей', () => {
    const state = fromListing({
      ...completeListing,
      checkInTime: '25:00',
      minNights: 7,
      maxNights: 3,
    });

    expect(stepIssues(4, state, 3)).toEqual(
      expect.arrayContaining([
        { field: 'checkInTime', code: 'invalid_time' },
        { field: 'maxNights', code: 'invalid_range' },
      ]),
    );
  });

  it('собирает все ошибки и знает, на каком шаге живёт поле', () => {
    const state = fromListing(demoListing);
    const issues = allStepIssues(state, 0);

    expect(issues.length).toBeGreaterThan(0);
    expect(fieldStep('photos')).toBe(3);
    expect(fieldStep('basePrice')).toBe(4);
    expect(fieldStep('city')).toBe(1);
    expect(fieldStep('unknown_field')).toBe(LAST_STEP);
  });
});
