import type { ListingDto, ListingPublishIssue } from '@staynest/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../../shared/i18n';
import { useToast } from '../../../shared/ui';
import { useReplaceAmenities, useUpdateListing } from '../../listings';
import { clearStoredDraft } from './draftStorage';
import { fromListing, stateSignature } from './form';
import type { ListingFormState } from './form';
import type { WizardStepIndex } from './steps';
import {
  AUTOSAVE_DELAY_MS,
  buildContext,
  enqueueSave,
  sortedIds,
  writeSnapshot,
} from './wizardSave';
import type {
  Mutations,
  SaveContext,
  SaveRefs,
  SaveResult,
  SaveSetters,
  SaveStatus,
} from './wizardSave';

export type { SaveStatus } from './wizardSave';

type Options = {
  listing: ListingDto;
  state: ListingFormState;
  step: WizardStepIndex;
  maxReached: WizardStepIndex;
  online: boolean;
  /** Пока пользователь не выбрал версию в конфликте, локальный снимок не перезаписываем. */
  snapshotPaused?: boolean;
  onServerIssues: (issues: ListingPublishIssue[]) => void;
};

export type Persistence = {
  status: SaveStatus;
  errorKey: TranslationKey | null;
  saving: boolean;
  persist: () => Promise<SaveResult>;
  retry: () => Promise<SaveResult>;
  clearError: () => void;
  clearSnapshot: () => void;
};

function useSaveRefs(options: Options): SaveRefs {
  const stateRef = useRef(options.state);
  const stepRef = useRef(options.step);
  const maxReachedRef = useRef(options.maxReached);
  const onlineRef = useRef(options.online);
  const serverIssuesRef = useRef(options.onServerIssues);
  const baseUpdatedAtRef = useRef(options.listing.updatedAt);
  const lastSavedRef = useRef(stateSignature(fromListing(options.listing)));
  const lastAmenitiesRef = useRef(
    sortedIds(options.listing.amenities.map((amenity) => amenity.id)),
  );

  stateRef.current = options.state;
  stepRef.current = options.step;
  maxReachedRef.current = options.maxReached;
  onlineRef.current = options.online;
  serverIssuesRef.current = options.onServerIssues;

  return {
    stateRef,
    stepRef,
    maxReachedRef,
    onlineRef,
    serverIssuesRef,
    baseUpdatedAtRef,
    lastSavedRef,
    lastAmenitiesRef,
  };
}

function useSaveContext(
  listingId: string,
  mutations: Mutations,
  refs: SaveRefs,
  setters: SaveSetters,
): MutableRefObject<SaveContext> {
  const ctxRef = useRef<SaveContext>(buildContext({ listingId, mutations, refs, setters }));
  ctxRef.current = buildContext({ listingId, mutations, refs, setters });
  return ctxRef;
}

type AutosaveInput = {
  state: ListingFormState;
  step: WizardStepIndex;
  maxReached: WizardStepIndex;
  online: boolean;
  listingId: string;
  listingStatus: ListingDto['status'];
  snapshotPaused: boolean;
  ctxRef: MutableRefObject<SaveContext>;
  chainRef: MutableRefObject<Promise<unknown>>;
  setStatus: (status: SaveStatus) => void;
};

function useAutosave({
  state,
  step,
  maxReached,
  online,
  listingId,
  listingStatus,
  snapshotPaused,
  ctxRef,
  chainRef,
  setStatus,
}: AutosaveInput): void {
  useEffect(() => {
    const ctx = ctxRef.current;
    const dirty = stateSignature(state) !== ctx.lastSavedRef.current;

    if (snapshotPaused) {
      if (dirty) setStatus('pending');
      return;
    }

    if (listingStatus !== 'draft') {
      if (!dirty) {
        clearStoredDraft(listingId);
        setStatus('saved');
        return;
      }

      writeSnapshot(ctx, true);
      setStatus(online ? 'pending' : 'offline');
      return;
    }

    writeSnapshot(ctx, dirty);

    if (!dirty) {
      setStatus('saved');
      return;
    }

    if (!online) {
      setStatus('offline');
      return;
    }

    setStatus('pending');
    const timer = setTimeout(() => void enqueueSave(ctxRef, chainRef), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    state,
    step,
    maxReached,
    online,
    listingId,
    listingStatus,
    snapshotPaused,
    ctxRef,
    chainRef,
    setStatus,
  ]);
}

function useSaveErrorToast(status: SaveStatus, errorKey: TranslationKey | null): void {
  const { t } = useTranslation();
  const toast = useToast();
  const lastKey = useRef<TranslationKey | null>(null);

  useEffect(() => {
    if (status === 'error' && errorKey && errorKey !== lastKey.current) {
      lastKey.current = errorKey;
      toast.show({ title: t(errorKey), tone: 'error' });
      return;
    }

    if (status !== 'error') lastKey.current = null;
  }, [status, errorKey, t, toast]);
}

export function useWizardPersistence({
  listing,
  state,
  step,
  maxReached,
  online,
  snapshotPaused = false,
  onServerIssues,
}: Options): Persistence {
  const update = useUpdateListing(listing.id);
  const amenities = useReplaceAmenities(listing.id);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);

  const refs = useSaveRefs({ listing, state, step, maxReached, online, onServerIssues });
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const ctxRef = useSaveContext(listing.id, { update, amenities }, refs, {
    setStatus,
    setSaving,
    setErrorKey,
  });

  useAutosave({
    state,
    step,
    maxReached,
    online,
    listingId: listing.id,
    listingStatus: listing.status,
    snapshotPaused,
    ctxRef,
    chainRef,
    setStatus,
  });

  useSaveErrorToast(status, errorKey);

  const persist = useCallback(() => enqueueSave(ctxRef, chainRef), [ctxRef, chainRef]);

  return {
    status,
    errorKey,
    saving,
    persist,
    retry: persist,
    clearError: () => setErrorKey(null),
    clearSnapshot: () => writeSnapshot(ctxRef.current, false),
  };
}
