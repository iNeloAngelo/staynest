import type { ListingDto, ListingType, UpdateListingInput } from '@staynest/shared';
import {
  MAX_LISTING_TITLE,
  MAX_MONEY_MINOR,
  MIN_LISTING_TITLE,
  textLength,
} from '@staynest/shared';
import { inputToInteger, inputToMinor, minorToInput } from '../../../shared/lib/format';

export type ListingFormState = {
  title: string;
  description: string;
  type: ListingType;
  city: string;
  region: string;
  addressLine: string;
  maxGuests: string;
  bedrooms: string;
  beds: string;
  bathrooms: string;
  areaSqm: string;
  basePrice: string;
  weekendPrice: string;
  cleaningFee: string;
  minNights: string;
  maxNights: string;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string;
  amenityIds: number[];
};

export type ListingFormIssue = {
  field: keyof ListingFormState | 'photos';
  code: string;
};

export type ListingFormErrors = Partial<Record<ListingFormIssue['field'], string>>;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function fromListing(listing: ListingDto): ListingFormState {
  return {
    title: listing.title ?? '',
    description: listing.description,
    type: listing.type,
    city: listing.city ?? '',
    region: listing.region ?? '',
    addressLine: listing.addressLine ?? '',
    maxGuests: listing.maxGuests === null ? '' : String(listing.maxGuests),
    bedrooms: listing.bedrooms === null ? '' : String(listing.bedrooms),
    beds: listing.beds === null ? '' : String(listing.beds),
    bathrooms: String(listing.bathrooms),
    areaSqm: listing.areaSqm === null ? '' : String(listing.areaSqm),
    basePrice: minorToInput(listing.basePriceMinor),
    weekendPrice: minorToInput(listing.weekendPriceMinor),
    cleaningFee: minorToInput(listing.cleaningFeeMinor),
    minNights: String(listing.minNights),
    maxNights: String(listing.maxNights),
    checkInTime: listing.checkInTime,
    checkOutTime: listing.checkOutTime,
    houseRules: listing.houseRules ?? '',
    amenityIds: listing.amenities.map((amenity) => amenity.id),
  };
}

function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function inRange(value: number | null, min: number, max: number): number | null {
  if (value === null || value < min || value > max) return null;
  return value;
}

/** Пустая строка — это «не заполнено» (null), а не ноль. */
function nullableInteger(raw: string, min: number, max: number): number | null {
  if (raw.trim() === '') return null;
  return inRange(inputToInteger(raw), min, max);
}

function boundedInteger(raw: string, min: number, max: number, fallback: number): number {
  if (raw.trim() === '') return fallback;
  return inRange(inputToInteger(raw), min, max) ?? fallback;
}

function money(raw: string): number | null {
  const value = inputToMinor(raw);
  return value !== null && value > 0 && value <= MAX_MONEY_MINOR ? value : null;
}

function fee(raw: string): number | null {
  const value = inputToMinor(raw);
  return value !== null && value >= 0 && value <= MAX_MONEY_MINOR ? value : null;
}

function issue(field: keyof ListingFormState, code: string): ListingFormIssue {
  return { field, code };
}

function isInvalid(raw: string, parsed: number | null): boolean {
  return raw.trim() !== '' && parsed === null;
}

/** Проверки формата полей. Полнота для публикации проверяется по шагам мастера. */
export function numericIssues(state: ListingFormState): ListingFormIssue[] {
  const checks: Array<[keyof ListingFormState, string, boolean]> = [
    [
      'maxGuests',
      'invalid_max_guests',
      isInvalid(state.maxGuests, nullableInteger(state.maxGuests, 1, 30)),
    ],
    [
      'bedrooms',
      'invalid_bedrooms',
      isInvalid(state.bedrooms, nullableInteger(state.bedrooms, 0, 20)),
    ],
    ['beds', 'invalid_beds', isInvalid(state.beds, nullableInteger(state.beds, 1, 40))],
    [
      'bathrooms',
      'invalid_bathrooms',
      isInvalid(state.bathrooms, nullableInteger(state.bathrooms, 0, 20)),
    ],
    ['areaSqm', 'invalid_area', isInvalid(state.areaSqm, nullableInteger(state.areaSqm, 1, 2000))],
    ['basePrice', 'invalid_price', isInvalid(state.basePrice, money(state.basePrice))],
    ['weekendPrice', 'invalid_price', isInvalid(state.weekendPrice, money(state.weekendPrice))],
    ['cleaningFee', 'invalid_price', isInvalid(state.cleaningFee, fee(state.cleaningFee))],
    [
      'minNights',
      'invalid_nights',
      isInvalid(state.minNights, nullableInteger(state.minNights, 1, 365)),
    ],
    [
      'maxNights',
      'invalid_nights',
      isInvalid(state.maxNights, nullableInteger(state.maxNights, 1, 365)),
    ],
    ['checkInTime', 'invalid_time', !TIME_PATTERN.test(state.checkInTime)],
    ['checkOutTime', 'invalid_time', !TIME_PATTERN.test(state.checkOutTime)],
  ];

  const issues = checks.filter(([, , failed]) => failed).map(([field, code]) => issue(field, code));

  const minNights = nullableInteger(state.minNights, 1, 365);
  const maxNights = nullableInteger(state.maxNights, 1, 365);
  if (minNights !== null && maxNights !== null && maxNights < minNights) {
    issues.push(issue('maxNights', 'invalid_range'));
  }

  const title = state.title.trim();
  if (title !== '' && textLength(title) < MIN_LISTING_TITLE) {
    issues.push(issue('title', 'title_too_short'));
  }
  if (textLength(title) > MAX_LISTING_TITLE) issues.push(issue('title', 'title_too_long'));

  return issues;
}

export function toUpdateInput(state: ListingFormState): {
  input: UpdateListingInput;
  issues: ListingFormIssue[];
} {
  const input: UpdateListingInput = {
    title: text(state.title),
    description: state.description.trim(),
    type: state.type,
    city: text(state.city),
    region: text(state.region),
    addressLine: text(state.addressLine),
    maxGuests: nullableInteger(state.maxGuests, 1, 30),
    bedrooms: nullableInteger(state.bedrooms, 0, 20),
    beds: nullableInteger(state.beds, 1, 40),
    bathrooms: boundedInteger(state.bathrooms, 0, 20, 1),
    areaSqm: nullableInteger(state.areaSqm, 1, 2000),
    basePriceMinor: money(state.basePrice),
    weekendPriceMinor: money(state.weekendPrice),
    cleaningFeeMinor: fee(state.cleaningFee) ?? 0,
    minNights: boundedInteger(state.minNights, 1, 365, 1),
    maxNights: boundedInteger(state.maxNights, 1, 365, 30),
    checkInTime: state.checkInTime,
    checkOutTime: state.checkOutTime,
    houseRules: text(state.houseRules),
  };

  return { input, issues: numericIssues(state) };
}

/** Подпись состояния формы: по ней мастер понимает, есть ли несохранённые правки. */
export function stateSignature(state: ListingFormState): string {
  return JSON.stringify(state);
}
