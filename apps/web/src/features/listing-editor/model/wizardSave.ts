import type {
  ListingDto,
  ListingPublishIssue,
  UpdateListingAmenitiesInput,
  UpdateListingInput,
} from '@staynest/shared';
import type { MutableRefObject } from 'react';
import type { TranslationKey } from '../../../shared/i18n';
import { ApiError } from '../../../shared/api';
import { publishIssuesFrom } from '../../listings';
import { makeStoredDraft, writeStoredDraft } from './draftStorage';
import { stateSignature, toUpdateInput } from './form';
import type { ListingFormIssue, ListingFormState } from './form';
import type { WizardStepIndex } from './steps';

export const AUTOSAVE_DELAY_MS = 900;

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'offline' | 'error';

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'validation'; issues: ListingFormIssue[] }
  | { ok: false; reason: 'server'; error: unknown };

export type Mutations = {
  update: { mutateAsync: (input: UpdateListingInput) => Promise<ListingDto> };
  amenities: { mutateAsync: (input: UpdateListingAmenitiesInput) => Promise<ListingDto> };
};

export type SaveRefs = {
  stateRef: MutableRefObject<ListingFormState>;
  stepRef: MutableRefObject<WizardStepIndex>;
  maxReachedRef: MutableRefObject<WizardStepIndex>;
  baseUpdatedAtRef: MutableRefObject<string>;
  lastSavedRef: MutableRefObject<string>;
  lastAmenitiesRef: MutableRefObject<number[]>;
  onlineRef: MutableRefObject<boolean>;
  serverIssuesRef: MutableRefObject<(issues: ListingPublishIssue[]) => void>;
};

export type SaveSetters = {
  setStatus: (status: SaveStatus) => void;
  setSaving: (saving: boolean) => void;
  setErrorKey: (key: TranslationKey | null) => void;
};

export type SaveContext = SaveRefs &
  SaveSetters & {
    listingId: string;
    mutations: Mutations;
  };

export function sortedIds(ids: number[]): number[] {
  return [...ids].sort((left, right) => left - right);
}

function sameIds(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function buildContext({
  listingId,
  mutations,
  refs,
  setters,
}: {
  listingId: string;
  mutations: Mutations;
  refs: SaveRefs;
  setters: SaveSetters;
}): SaveContext {
  return { listingId, mutations, ...refs, ...setters };
}

export function writeSnapshot(ctx: SaveContext, dirty: boolean): void {
  writeStoredDraft(
    makeStoredDraft({
      listingId: ctx.listingId,
      form: ctx.stateRef.current,
      step: ctx.stepRef.current,
      maxReached: ctx.maxReachedRef.current,
      baseUpdatedAt: ctx.baseUpdatedAtRef.current,
      dirty,
    }),
  );
}

function reportSaveError(ctx: SaveContext, error: unknown): SaveResult {
  const serverIssues = publishIssuesFrom(error);

  if (serverIssues.length > 0) {
    ctx.serverIssuesRef.current(serverIssues);
    ctx.setStatus('error');
    ctx.setErrorKey('listings.errors.incomplete');
  } else if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    ctx.setStatus('error');
    ctx.setErrorKey('listings.errors.unauthorized');
  } else {
    ctx.setStatus(ctx.onlineRef.current ? 'error' : 'offline');
    ctx.setErrorKey(
      ctx.onlineRef.current ? 'listings.wizard.saveFailed' : 'listings.wizard.save.offline',
    );
  }

  writeSnapshot(ctx, true);
  return { ok: false, reason: 'server', error };
}

async function saveSnapshot(ctx: SaveContext): Promise<SaveResult> {
  const form = ctx.stateRef.current;
  const signature = stateSignature(form);
  if (signature === ctx.lastSavedRef.current) {
    ctx.setStatus('saved');
    return { ok: true };
  }

  const { input, issues } = toUpdateInput(form);
  if (issues.length > 0) {
    writeSnapshot(ctx, true);
    return { ok: false, reason: 'validation', issues };
  }

  ctx.setSaving(true);
  ctx.setStatus('saving');
  ctx.setErrorKey(null);

  const amenitiesChanged = !sameIds(sortedIds(form.amenityIds), ctx.lastAmenitiesRef.current);

  try {
    let updated = await ctx.mutations.update.mutateAsync(input);
    if (amenitiesChanged) {
      updated = await ctx.mutations.amenities.mutateAsync({ amenityIds: form.amenityIds });
      ctx.lastAmenitiesRef.current = sortedIds(form.amenityIds);
    }

    ctx.lastSavedRef.current = signature;
    ctx.baseUpdatedAtRef.current = updated.updatedAt;
    const dirty = stateSignature(ctx.stateRef.current) !== signature;
    writeSnapshot(ctx, dirty);
    ctx.setStatus(dirty ? 'pending' : 'saved');
    return { ok: true };
  } catch (error) {
    return reportSaveError(ctx, error);
  } finally {
    ctx.setSaving(false);
  }
}

export function enqueueSave(
  ctxRef: MutableRefObject<SaveContext>,
  chainRef: MutableRefObject<Promise<unknown>>,
): Promise<SaveResult> {
  const next = chainRef.current.then(() => saveSnapshot(ctxRef.current));
  chainRef.current = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
