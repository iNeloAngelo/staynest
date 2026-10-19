import type { ListingPublishIssue } from '@staynest/shared';
import type { ListingFormIssue } from './form';
import type { WizardForm } from './useWizardForm';
import type { WizardSteps } from './useWizardSteps';
import { scrollWizardTop } from './useWizardSteps';
import { fieldStep, stepIssues } from './steps';
import type { WizardStepIndex } from './steps';
import { fieldAnchor } from '../../listings';

export type WizardIssues = {
  clientIssues: ListingFormIssue[];
  publishIssues: ListingPublishIssue[];
  showClientIssues: (issues: ListingFormIssue[]) => void;
  handleServerIssues: (issues: ListingPublishIssue[]) => void;
  goNext: () => boolean;
  focusIssue: (issue: { field: string }) => void;
};

type Options = {
  form: WizardForm;
  steps: WizardSteps;
  photoCount: number;
};

export function useWizardIssues({ form, steps, photoCount }: Options): WizardIssues {
  function jumpToIssue(field: string): void {
    const target: WizardStepIndex = fieldStep(field);
    steps.setStep(target);
    steps.setMaxReached((current) => Math.max(current, target));
    scrollWizardTop();
  }

  function showClientIssues(issues: ListingFormIssue[]): void {
    form.setClientIssues(issues);
    form.setPublishIssues([]);
    const first = issues[0];
    if (first) jumpToIssue(first.field);
  }

  function handleServerIssues(issues: ListingPublishIssue[]): void {
    form.setPublishIssues(issues);
    form.setClientIssues([]);
    const first = issues[0];
    if (first) jumpToIssue(first.field);
  }

  function focusIssue(issue: { field: string }): void {
    jumpToIssue(issue.field);
    const anchor = fieldAnchor(issue.field);
    setTimeout(() => {
      if (anchor) {
        document.getElementById(anchor)?.focus();
        return;
      }
      document.getElementById('wizard-step-heading')?.focus();
    }, 50);
  }

  function goNext(): boolean {
    const issues = stepIssues(steps.step, form.state, photoCount);
    if (issues.length > 0) {
      showClientIssues(issues);
      return false;
    }

    form.setClientIssues([]);
    steps.advance();
    return true;
  }

  return {
    clientIssues: form.clientIssues,
    publishIssues: form.publishIssues,
    showClientIssues,
    handleServerIssues,
    goNext,
    focusIssue,
  };
}
