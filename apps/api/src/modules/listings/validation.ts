import type { ListingPublishIssue } from '@staynest/shared';
import { invalidNightsRange } from './errors';
import type { ListingRow } from './repo';

export type CompletenessFields = Pick<
  ListingRow,
  | 'title'
  | 'description'
  | 'city'
  | 'address_line'
  | 'max_guests'
  | 'bedrooms'
  | 'beds'
  | 'base_price_minor'
>;

function issue(field: string, code: string, message: string): ListingPublishIssue {
  return { field, code, message };
}

type Check = [field: string, code: string, message: string, failed: boolean];

/** Проверки полноты одинаковы для публикации и для правки опубликованного. */
export function completenessIssues(fields: CompletenessFields): ListingPublishIssue[] {
  const title = fields.title?.trim() ?? '';
  const description = fields.description.trim();

  const checks: Check[] = [
    ['title', 'title_required', 'Укажите название объявления.', title === ''],
    [
      'title',
      'title_too_short',
      'Название: не менее 5 символов.',
      title !== '' && title.length < 5,
    ],
    [
      'description',
      'description_too_short',
      'Описание: не менее 50 символов.',
      description.length < 50,
    ],
    ['city', 'city_required', 'Укажите город.', !fields.city?.trim()],
    ['addressLine', 'address_required', 'Укажите адрес.', !fields.address_line?.trim()],
    ['maxGuests', 'max_guests_required', 'Укажите число гостей.', fields.max_guests === null],
    ['bedrooms', 'bedrooms_required', 'Укажите число спален.', fields.bedrooms === null],
    ['beds', 'beds_required', 'Укажите число кроватей.', fields.beds === null],
    [
      'basePriceMinor',
      'base_price_required',
      'Укажите цену за ночь.',
      fields.base_price_minor === null,
    ],
  ];

  return checks
    .filter(([, , , failed]) => failed)
    .map(([field, code, message]) => issue(field, code, message));
}

export function publishIssues(
  fields: CompletenessFields,
  photoCount: number,
): ListingPublishIssue[] {
  const issues = completenessIssues(fields);

  if (photoCount < 3) {
    issues.push(issue('photos', 'photos_too_few', 'Добавьте минимум 3 фотографии.'));
  }

  return issues;
}

export function assertNightsRange(minNights: number, maxNights: number): void {
  if (maxNights < minNights) throw invalidNightsRange();
}
