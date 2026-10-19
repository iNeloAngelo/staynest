import { MIN_PUBLISHED_DESCRIPTION, MIN_PUBLISHED_PHOTOS, textLength } from '@staynest/shared';
import { numericIssues } from './form';
import type { ListingFormIssue, ListingFormState } from './form';

export const WIZARD_STEPS = [
  {
    id: 'basics',
    labelKey: 'listings.wizard.steps.basics',
    fields: ['title', 'description', 'type'],
  },
  {
    id: 'location',
    labelKey: 'listings.wizard.steps.location',
    fields: ['city', 'region', 'addressLine'],
  },
  {
    id: 'features',
    labelKey: 'listings.wizard.steps.features',
    fields: ['maxGuests', 'bedrooms', 'beds', 'bathrooms', 'areaSqm', 'amenityIds'],
  },
  {
    id: 'photos',
    labelKey: 'listings.wizard.steps.photos',
    fields: ['photos'],
  },
  {
    id: 'pricing',
    labelKey: 'listings.wizard.steps.pricing',
    fields: [
      'basePrice',
      'weekendPrice',
      'cleaningFee',
      'minNights',
      'maxNights',
      'checkInTime',
      'checkOutTime',
      'houseRules',
    ],
  },
] as const;

export type WizardStepIndex = number;

export const LAST_STEP: WizardStepIndex = WIZARD_STEPS.length - 1;

const FIELD_STEPS: Record<ListingFormIssue['field'], WizardStepIndex> = {
  title: 0,
  description: 0,
  type: 0,
  city: 1,
  region: 1,
  addressLine: 1,
  maxGuests: 2,
  bedrooms: 2,
  beds: 2,
  bathrooms: 2,
  areaSqm: 2,
  amenityIds: 2,
  houseRules: 4,
  photos: 3,
  basePrice: 4,
  weekendPrice: 4,
  cleaningFee: 4,
  minNights: 4,
  maxNights: 4,
  checkInTime: 4,
  checkOutTime: 4,
};

function issue(field: ListingFormIssue['field'], code: string): ListingFormIssue {
  return { field, code };
}

function basicsIssues(state: ListingFormState): ListingFormIssue[] {
  const issues: ListingFormIssue[] = [];
  const title = state.title.trim();
  const description = state.description.trim();

  if (title === '') issues.push(issue('title', 'title_required'));
  else if (textLength(title) < 5) issues.push(issue('title', 'title_too_short'));
  else if (textLength(title) > 120) issues.push(issue('title', 'title_too_long'));

  if (textLength(description) < MIN_PUBLISHED_DESCRIPTION) {
    issues.push(issue('description', 'description_too_short'));
  }

  return issues;
}

function locationIssues(state: ListingFormState): ListingFormIssue[] {
  const issues: ListingFormIssue[] = [];
  if (!state.city.trim()) issues.push(issue('city', 'city_required'));
  if (!state.addressLine.trim()) issues.push(issue('addressLine', 'address_required'));
  return issues;
}

function featureIssues(state: ListingFormState): ListingFormIssue[] {
  const issues: ListingFormIssue[] = [];
  if (state.maxGuests.trim() === '') issues.push(issue('maxGuests', 'max_guests_required'));
  if (state.bedrooms.trim() === '') issues.push(issue('bedrooms', 'bedrooms_required'));
  if (state.beds.trim() === '') issues.push(issue('beds', 'beds_required'));
  return issues;
}

function pricingIssues(state: ListingFormState): ListingFormIssue[] {
  const issues: ListingFormIssue[] = [];
  if (state.basePrice.trim() === '') issues.push(issue('basePrice', 'base_price_required'));
  return issues;
}

const REQUIRED_ISSUES: Array<(state: ListingFormState) => ListingFormIssue[]> = [
  basicsIssues,
  locationIssues,
  featureIssues,
  () => [],
  pricingIssues,
];

function sortedIssues(issues: ListingFormIssue[]): ListingFormIssue[] {
  const seen = new Set<string>();
  return issues.filter((item) => {
    const key = `${item.field}:${item.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Проверки текущего шага: формат полей плюс полнота для публикации. */
export function stepIssues(
  step: WizardStepIndex,
  state: ListingFormState,
  photoCount: number,
): ListingFormIssue[] {
  if (step === 3) {
    return photoCount < MIN_PUBLISHED_PHOTOS ? [issue('photos', 'photos_too_few')] : [];
  }

  const stepFields = new Set<string>(WIZARD_STEPS[step]?.fields ?? []);
  const required = REQUIRED_ISSUES[step]?.(state) ?? [];
  const format = numericIssues(state).filter((item) => stepFields.has(item.field));

  return sortedIssues([...required, ...format]);
}

export function allStepIssues(state: ListingFormState, photoCount: number): ListingFormIssue[] {
  return sortedIssues(WIZARD_STEPS.flatMap((_, index) => stepIssues(index, state, photoCount)));
}

/** Первый незаконченный шаг: на нём мастер открывает существующий черновик. */
export function firstIncompleteStep(state: ListingFormState, photoCount: number): WizardStepIndex {
  for (let index = 0; index < WIZARD_STEPS.length; index += 1) {
    if (stepIssues(index, state, photoCount).length > 0) return index;
  }

  return LAST_STEP;
}

export function fieldStep(field: string): WizardStepIndex {
  return FIELD_STEPS[field as ListingFormIssue['field']] ?? LAST_STEP;
}

export function stepFromUnknown(value: unknown): WizardStepIndex {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 0;
  if (value < 0) return 0;
  return Math.min(value, LAST_STEP);
}
