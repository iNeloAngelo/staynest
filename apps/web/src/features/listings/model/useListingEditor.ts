import type { ListingDto } from '@staynest/shared';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/ui';
import {
  useArchiveListing,
  useDeleteListing,
  usePublishListing,
  useReplaceAmenities,
  useUpdateListing,
} from '../api/hooks';
import { issueTextKey, listingsErrorKey, publishIssuesFrom } from './errors';
import { fromListing, toUpdateInput } from './form';
import type { ListingFormErrors, ListingFormIssue, ListingFormState } from './form';

export function useListingForm(listing: ListingDto) {
  const [state, setState] = useState<ListingFormState>(() => fromListing(listing));

  useEffect(() => {
    setState(fromListing(listing));
  }, [listing]);

  function setField<K extends keyof ListingFormState>(field: K, value: ListingFormState[K]): void {
    setState((current) => ({ ...current, [field]: value }));
  }

  return { state, setField };
}

function errorMap(issues: ListingFormIssue[], t: TFunction): ListingFormErrors {
  const errors: ListingFormErrors = {};

  for (const item of issues) {
    errors[item.field] = t(issueTextKey(item.code));
  }

  return errors;
}

function usePersistence(listing: ListingDto, form: ListingFormState) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateListing(listing.id);
  const amenities = useReplaceAmenities(listing.id);
  const [formErrors, setFormErrors] = useState<ListingFormErrors>({});

  async function persist(): Promise<boolean> {
    const { input, issues } = toUpdateInput(form);

    if (issues.length > 0) {
      setFormErrors(errorMap(issues, t));
      return false;
    }

    setFormErrors({});

    try {
      await update.mutateAsync(input);
      await amenities.mutateAsync({ amenityIds: form.amenityIds });
      return true;
    } catch (error) {
      toast.show({ title: t(listingsErrorKey(error)), tone: 'error' });
      return false;
    }
  }

  async function save(): Promise<void> {
    if (await persist()) toast.show({ title: t('listings.editor.saved'), tone: 'success' });
  }

  return {
    formErrors,
    saving: update.isPending || amenities.isPending,
    persist,
    save,
  };
}

function useStatusActions(
  listing: ListingDto,
  persist: () => Promise<boolean>,
  onDeleted: () => void,
) {
  const { t } = useTranslation();
  const toast = useToast();
  const publish = usePublishListing();
  const archive = useArchiveListing();
  const remove = useDeleteListing();
  const [publishIssues, setPublishIssues] = useState<ReturnType<typeof publishIssuesFrom>>([]);

  function reportError(error: unknown): void {
    const issues = publishIssuesFrom(error);
    setPublishIssues(issues);
    if (issues.length === 0) {
      toast.show({ title: t(listingsErrorKey(error)), tone: 'error' });
    }
  }

  async function publishNow(): Promise<void> {
    setPublishIssues([]);
    if (!(await persist())) return;

    try {
      await publish.mutateAsync(listing.id);
      toast.show({ title: t('listings.editor.published'), tone: 'success' });
    } catch (error) {
      reportError(error);
    }
  }

  async function archiveNow(): Promise<void> {
    try {
      await archive.mutateAsync(listing.id);
      toast.show({ title: t('listings.editor.archived'), tone: 'success' });
    } catch (error) {
      reportError(error);
    }
  }

  async function removeNow(): Promise<void> {
    try {
      await remove.mutateAsync(listing.id);
      toast.show({ title: t('listings.editor.deleted'), tone: 'success' });
      onDeleted();
    } catch (error) {
      reportError(error);
    }
  }

  return {
    publishIssues,
    publishing: publish.isPending,
    archiving: archive.isPending,
    deleting: remove.isPending,
    publishNow,
    archiveNow,
    removeNow,
  };
}

export function useListingActions(
  listing: ListingDto,
  form: ListingFormState,
  onDeleted: () => void,
) {
  const persistence = usePersistence(listing, form);
  const status = useStatusActions(listing, persistence.persist, onDeleted);

  return { ...persistence, ...status };
}
