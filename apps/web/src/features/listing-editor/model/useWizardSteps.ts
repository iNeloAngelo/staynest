import { useState } from 'react';
import { LAST_STEP, stepFromUnknown } from './steps';
import type { WizardStepIndex } from './steps';
import type { InitialWizardState } from './wizardState';

export function scrollWizardTop(): void {
  const element = document.getElementById('wizard-top');
  if (element && typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ block: 'start' });
  }
}

export type WizardSteps = {
  step: WizardStepIndex;
  maxReached: WizardStepIndex;
  setStep: (step: WizardStepIndex) => void;
  setMaxReached: (updater: (current: WizardStepIndex) => WizardStepIndex) => void;
  goTo: (index: WizardStepIndex) => void;
  goBack: () => void;
  advance: () => void;
  applyStep: (restored: { step: WizardStepIndex; maxReached: WizardStepIndex }) => void;
};

export function useWizardSteps(initial: InitialWizardState): WizardSteps {
  const [step, setStep] = useState(initial.step);
  const [maxReached, setMaxReached] = useState(initial.maxReached);

  function goTo(index: WizardStepIndex): void {
    if (index < 0 || index > maxReached) return;
    setStep(index);
    scrollWizardTop();
  }

  function goBack(): void {
    setStep((current) => Math.max(0, current - 1));
    scrollWizardTop();
  }

  function advance(): void {
    const next = Math.min(step + 1, LAST_STEP);
    setStep(next);
    setMaxReached((current) => Math.max(current, next));
    scrollWizardTop();
  }

  function applyStep(restored: { step: WizardStepIndex; maxReached: WizardStepIndex }): void {
    setStep(stepFromUnknown(restored.step));
    setMaxReached(stepFromUnknown(restored.maxReached));
  }

  return { step, maxReached, setStep, setMaxReached, goTo, goBack, advance, applyStep };
}
