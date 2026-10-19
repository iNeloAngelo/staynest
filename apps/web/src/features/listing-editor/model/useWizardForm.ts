import type { ListingDto, ListingPublishIssue } from '@staynest/shared';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../../shared/i18n';
import { issueTextKey } from '../../listings';
import type { ListingFormErrors, ListingFormIssue, ListingFormState } from './form';
import type { InitialWizardState } from './wizardState';
import { initialWizardState } from './wizardState';

const SERVER_FIELDS: Record<string, keyof ListingFormState> = {
  basePriceMinor: 'basePrice',
  weekendPriceMinor: 'weekendPrice',
  cleaningFeeMinor: 'cleaningFee',
};

function issuesToErrors(
  issues: Array<{ field: string; code: string }>,
  translate: (key: TranslationKey) => string,
): ListingFormErrors {
  const errors: ListingFormErrors = {};

  for (const item of issues) {
    const field = SERVER_FIELDS[item.field] ?? item.field;
    if (field === 'photos') continue;
    errors[field as keyof ListingFormState] = translate(issueTextKey(item.code));
  }

  return errors;
}

export type WizardForm = {
  initial: InitialWizardState;
  state: ListingFormState;
  clientIssues: ListingFormIssue[];
  publishIssues: ListingPublishIssue[];
  errors: ListingFormErrors;
  setField: <K extends keyof ListingFormState>(field: K, value: ListingFormState[K]) => void;
  setClientIssues: (issues: ListingFormIssue[]) => void;
  setPublishIssues: (issues: ListingPublishIssue[]) => void;
  applyForm: (form: ListingFormState) => void;
};

export function useWizardForm(listing: ListingDto): WizardForm {
  const { t } = useTranslation();
  const initialRef = useRef<InitialWizardState | null>(null);
  if (!initialRef.current) initialRef.current = initialWizardState(listing);
  const initial = initialRef.current;

  const [state, setState] = useState<ListingFormState>(initial.form);
  const [clientIssues, setClientIssues] = useState<ListingFormIssue[]>([]);
  const [publishIssues, setPublishIssues] = useState<ListingPublishIssue[]>([]);

  function setField<K extends keyof ListingFormState>(field: K, value: ListingFormState[K]): void {
    setState((current) => ({ ...current, [field]: value }));
    setClientIssues((current) => current.filter((item) => item.field !== field));
    setPublishIssues((current) => current.filter((item) => item.field !== field));
  }

  const errors = issuesToErrors([...clientIssues, ...publishIssues], t);

  return {
    initial,
    state,
    clientIssues,
    publishIssues,
    errors,
    setField,
    setClientIssues,
    setPublishIssues,
    applyForm: setState,
  };
}
