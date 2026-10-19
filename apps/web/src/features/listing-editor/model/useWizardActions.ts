import type { ListingDto } from '@staynest/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../../shared/api';
import type { TranslationKey } from '../../../shared/i18n';
import { useToast } from '../../../shared/ui';
import {
  listingsErrorKey,
  publishIssuesFrom,
  useArchiveListing,
  useDeleteListing,
  usePublishListing,
} from '../../listings';
import { clearStoredDraft } from './draftStorage';
import { allStepIssues } from './steps';
import type { Persistence } from './useWizardPersistence';
import type { WizardForm } from './useWizardForm';
import type { WizardIssues } from './useWizardIssues';

export type WizardActionErrors = {
  actionError: TranslationKey | null;
  actionConflict: boolean;
  reportError: (error: unknown) => void;
  clearActionError: () => void;
  refreshConflict: () => void;
};

export function useActionErrors(): WizardActionErrors {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<TranslationKey | null>(null);
  const [actionConflict, setActionConflict] = useState(false);

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ['listings', 'mine'], refetchType: 'active' });
  }

  function refresh(): void {
    setActionError(null);
    setActionConflict(false);
    invalidate();
  }

  function reportError(error: unknown): void {
    const conflict = error instanceof ApiError && error.status === 409;
    setActionError(listingsErrorKey(error));
    setActionConflict(conflict);
    if (conflict) invalidate();
  }

  return {
    actionError,
    actionConflict,
    reportError,
    clearActionError: () => {
      setActionError(null);
      setActionConflict(false);
    },
    refreshConflict: refresh,
  };
}

function useSaveAction({
  persistence,
  issues,
}: {
  persistence: Persistence;
  issues: WizardIssues;
}) {
  const { t } = useTranslation();
  const toast = useToast();

  return async function saveNow(): Promise<void> {
    const result = await persistence.persist();

    if (result.ok) {
      toast.show({ title: t('listings.editor.saved'), tone: 'success' });
      return;
    }

    if (result.reason === 'validation') issues.showClientIssues(result.issues);
  };
}

type PublishOptions = {
  listing: ListingDto;
  persistence: Persistence;
  form: WizardForm;
  issues: WizardIssues;
  errors: WizardActionErrors;
  photoCount: number;
};

function usePublishAction({
  listing,
  persistence,
  form,
  issues,
  errors,
  photoCount,
}: PublishOptions) {
  const { t } = useTranslation();
  const toast = useToast();
  const publish = usePublishListing();
  const inFlight = useRef(false);

  async function runPublish(): Promise<void> {
    errors.clearActionError();
    const clientIssues = allStepIssues(form.state, photoCount);
    if (clientIssues.length > 0) {
      issues.showClientIssues(clientIssues);
      return;
    }

    const saved = await persistence.persist();
    if (!saved.ok) {
      if (saved.reason === 'validation') issues.showClientIssues(saved.issues);
      return;
    }

    try {
      await publish.mutateAsync(listing.id);
      clearStoredDraft(listing.id);
      form.setClientIssues([]);
      form.setPublishIssues([]);
      toast.show({ title: t('listings.editor.published'), tone: 'success' });
    } catch (error) {
      const serverIssues = publishIssuesFrom(error);
      if (serverIssues.length > 0) issues.handleServerIssues(serverIssues);
      else errors.reportError(error);
    }
  }

  async function publishNow(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await runPublish();
    } finally {
      inFlight.current = false;
    }
  }

  return { publishNow, publishing: publish.isPending };
}

function useArchiveAction({
  listing,
  errors,
}: {
  listing: ListingDto;
  errors: WizardActionErrors;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const archive = useArchiveListing();

  async function archiveNow(): Promise<void> {
    errors.clearActionError();

    try {
      await archive.mutateAsync(listing.id);
      toast.show({ title: t('listings.editor.archived'), tone: 'success' });
    } catch (error) {
      errors.reportError(error);
    }
  }

  return { archiveNow, archiving: archive.isPending };
}

function useDeleteAction({ listing, errors }: { listing: ListingDto; errors: WizardActionErrors }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const remove = useDeleteListing();

  async function removeNow(): Promise<void> {
    errors.clearActionError();

    try {
      await remove.mutateAsync(listing.id);
      clearStoredDraft(listing.id);
      toast.show({ title: t('listings.editor.deleted'), tone: 'success' });
      navigate('/host/listings');
    } catch (error) {
      errors.reportError(error);
    }
  }

  return { removeNow, deleting: remove.isPending };
}

type WizardConfirm = 'archive' | 'delete' | null;

export type WizardActions = {
  confirm: WizardConfirm;
  setConfirm: (confirm: WizardConfirm) => void;
  saveNow: () => Promise<void>;
  publishNow: () => Promise<void>;
  archiveNow: () => Promise<void>;
  removeNow: () => Promise<void>;
  publishing: boolean;
  archiving: boolean;
  deleting: boolean;
};

type Options = {
  listing: ListingDto;
  persistence: Persistence;
  form: WizardForm;
  issues: WizardIssues;
  errors: WizardActionErrors;
  photoCount: number;
};

export function useWizardActions(options: Options): WizardActions {
  const { listing, persistence, issues, errors } = options;
  const [confirm, setConfirm] = useState<WizardConfirm>(null);
  const saveNow = useSaveAction({ persistence, issues });
  const publish = usePublishAction(options);
  const archive = useArchiveAction({ listing, errors });
  const remove = useDeleteAction({ listing, errors });

  return {
    confirm,
    setConfirm,
    saveNow,
    publishNow: publish.publishNow,
    archiveNow: archive.archiveNow,
    removeNow: remove.removeNow,
    publishing: publish.publishing,
    archiving: archive.archiving,
    deleting: remove.deleting,
  };
}
