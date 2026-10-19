import type { ListingFormState } from './form';
import { stepFromUnknown } from './steps';
import type { WizardStepIndex } from './steps';

const KEY_PREFIX = 'staynest:listing-draft:';
const STORAGE_VERSION = 1;

export type StoredDraft = {
  version: number;
  listingId: string;
  step: WizardStepIndex;
  maxReached: WizardStepIndex;
  form: ListingFormState;
  /** Время последнего локального изменения: позволяет отличить свои правки от чужих. */
  savedAt: number;
  /** Версия сервера на момент локального снимка. */
  baseUpdatedAt: string;
  dirty: boolean;
};

function storageKey(listingId: string): string {
  return `${KEY_PREFIX}${listingId}`;
}

const STRING_FIELDS: Array<keyof ListingFormState> = [
  'title',
  'description',
  'type',
  'city',
  'region',
  'addressLine',
  'maxGuests',
  'bedrooms',
  'beds',
  'bathrooms',
  'areaSqm',
  'basePrice',
  'weekendPrice',
  'cleaningFee',
  'minNights',
  'maxNights',
  'checkInTime',
  'checkOutTime',
  'houseRules',
];

function isFormState(value: unknown): value is ListingFormState {
  if (typeof value !== 'object' || value === null) return false;
  const form = value as Partial<ListingFormState>;

  return (
    STRING_FIELDS.every((key) => typeof form[key] === 'string') &&
    Array.isArray(form.amenityIds) &&
    form.amenityIds.every((id) => typeof id === 'number')
  );
}

function parseDraft(listingId: string, raw: string): StoredDraft | null {
  try {
    const data = JSON.parse(raw) as Partial<StoredDraft>;
    if (data.version !== STORAGE_VERSION) return null;
    if (data.listingId !== listingId) return null;
    if (!isFormState(data.form)) return null;
    if (typeof data.baseUpdatedAt !== 'string') return null;
    if (typeof data.savedAt !== 'number') return null;
    if (typeof data.dirty !== 'boolean') return null;

    return {
      version: STORAGE_VERSION,
      listingId,
      step: stepFromUnknown(data.step),
      maxReached: stepFromUnknown(data.maxReached),
      form: data.form,
      savedAt: data.savedAt,
      baseUpdatedAt: data.baseUpdatedAt,
      dirty: data.dirty,
    };
  } catch {
    return null;
  }
}

export function readStoredDraft(listingId: string): StoredDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(listingId));
    return raw ? parseDraft(listingId, raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredDraft(draft: StoredDraft): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey(draft.listingId), JSON.stringify(draft));
  } catch {
    // Приватный режим или переполненное хранилище: мастер продолжает работать без снимка.
  }
}

export function clearStoredDraft(listingId: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(storageKey(listingId));
  } catch {
    // Удалять нечего — это не мешает публикации.
  }
}

export type DraftSnapshot = {
  listingId: string;
  form: ListingFormState;
  step: WizardStepIndex;
  maxReached: WizardStepIndex;
  baseUpdatedAt: string;
  dirty: boolean;
};

export function makeStoredDraft(input: DraftSnapshot): StoredDraft {
  return {
    version: STORAGE_VERSION,
    listingId: input.listingId,
    step: input.step,
    maxReached: input.maxReached,
    form: input.form,
    savedAt: Date.now(),
    baseUpdatedAt: input.baseUpdatedAt,
    dirty: input.dirty,
  };
}
