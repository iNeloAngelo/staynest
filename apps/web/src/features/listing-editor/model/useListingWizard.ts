import type { ListingDto } from '@staynest/shared';
import { useOnline } from '../../../shared/lib/useOnline';
import { applyStoredDraft } from './wizardState';
import { LAST_STEP } from './steps';
import { useActionErrors, useWizardActions } from './useWizardActions';
import { useWizardConflict } from './useWizardConflict';
import { useWizardForm } from './useWizardForm';
import { useWizardIssues } from './useWizardIssues';
import { useWizardPersistence } from './useWizardPersistence';
import { useWizardSteps } from './useWizardSteps';

export function useListingWizard(listing: ListingDto) {
  const online = useOnline();
  const form = useWizardForm(listing);
  const steps = useWizardSteps(form.initial);
  const conflict = useWizardConflict(form.initial);
  const photoCount = listing.photos.length;
  const issues = useWizardIssues({ form, steps, photoCount });
  const errors = useActionErrors();

  const persistence = useWizardPersistence({
    listing,
    state: form.state,
    step: steps.step,
    maxReached: steps.maxReached,
    online,
    snapshotPaused: Boolean(conflict.conflictDraft),
    onServerIssues: issues.handleServerIssues,
  });

  const actions = useWizardActions({
    listing,
    persistence,
    form,
    issues,
    errors,
    photoCount,
  });

  function restoreMine(): void {
    const draft = conflict.takeMine();
    if (!draft) return;

    const restored = applyStoredDraft(draft);
    form.applyForm(restored.form);
    steps.applyStep(restored);
    conflict.showRestored(restored.step);
  }

  const busy =
    persistence.saving ||
    actions.publishing ||
    actions.archiving ||
    actions.deleting ||
    Boolean(actions.confirm);

  return {
    ...form,
    ...steps,
    ...issues,
    ...conflict,
    ...errors,
    ...persistence,
    ...actions,
    photoCount,
    online,
    busy,
    restoreMine,
    lastStep: LAST_STEP,
  };
}

export type ListingWizardController = ReturnType<typeof useListingWizard>;
