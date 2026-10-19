import type { ListingDto } from '@staynest/shared';
import { readStoredDraft } from './draftStorage';
import type { StoredDraft } from './draftStorage';
import { fromListing } from './form';
import type { ListingFormState } from './form';
import { LAST_STEP, firstIncompleteStep, stepFromUnknown } from './steps';
import type { WizardStepIndex } from './steps';

const SERVER_CHANGED_MS = 1000;

export type WizardNotice =
  | { kind: 'restored'; step: WizardStepIndex }
  | { kind: 'resumed'; step: WizardStepIndex }
  | { kind: 'conflict'; draft: StoredDraft };

export type InitialWizardState = {
  form: ListingFormState;
  step: WizardStepIndex;
  maxReached: WizardStepIndex;
  notice: WizardNotice | null;
};

function serverChangedAfter(listing: ListingDto, draft: StoredDraft): boolean {
  const serverTime = new Date(listing.updatedAt).getTime();
  const baseTime = new Date(draft.baseUpdatedAt).getTime();
  if (!Number.isFinite(serverTime) || !Number.isFinite(baseTime)) return false;

  return serverTime > baseTime + SERVER_CHANGED_MS;
}

function restoredState(draft: StoredDraft): InitialWizardState {
  const step = stepFromUnknown(draft.step);

  return {
    form: draft.form,
    step,
    maxReached: Math.max(step, stepFromUnknown(draft.maxReached)),
    notice: { kind: 'restored', step },
  };
}

/** Начальное состояние мастера: незаконченный черновик продолжается с первого пробела. */
export function initialWizardState(listing: ListingDto): InitialWizardState {
  const serverForm = fromListing(listing);
  const draft = readStoredDraft(listing.id);
  const isDraft = listing.status === 'draft';

  if (draft?.dirty) {
    if (serverChangedAfter(listing, draft)) {
      const step = firstIncompleteStep(serverForm, listing.photos.length);
      return { form: serverForm, step, maxReached: step, notice: { kind: 'conflict', draft } };
    }

    return restoredState(draft);
  }

  const step = isDraft ? firstIncompleteStep(serverForm, listing.photos.length) : 0;

  return {
    form: serverForm,
    step,
    maxReached: isDraft ? step : LAST_STEP,
    notice: isDraft && step > 0 ? { kind: 'resumed', step } : null,
  };
}

export function applyStoredDraft(draft: StoredDraft): InitialWizardState {
  return restoredState(draft);
}
