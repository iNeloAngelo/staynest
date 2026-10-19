import type { PriceRuleDto, PriceRuleInput } from '@staynest/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { Modal } from '../../../shared/ui/Modal';
import { inputToInteger, inputToMinor, minorToInput } from '../../../shared/lib/format';

type RuleValues = {
  name: string;
  dateFrom: string;
  dateTo: string;
  price: string;
  minNights: string;
  priority: string;
};

type RuleField = keyof RuleValues;

const EMPTY: RuleValues = {
  name: '',
  dateFrom: '',
  dateTo: '',
  price: '',
  minNights: '',
  priority: '0',
};

function valuesFrom(rule: PriceRuleDto | null): RuleValues {
  if (!rule) return EMPTY;

  return {
    name: rule.name,
    dateFrom: rule.dateFrom,
    dateTo: rule.dateTo,
    price: minorToInput(rule.nightlyPriceMinor),
    minNights: rule.minNights === null ? '' : String(rule.minNights),
    priority: String(rule.priority),
  };
}

function buildInput(values: RuleValues): PriceRuleInput | null {
  const price = inputToMinor(values.price);
  const minNights = inputToInteger(values.minNights);
  const priority = inputToInteger(values.priority);
  if (
    !values.name.trim() ||
    !values.dateFrom ||
    !values.dateTo ||
    price === null ||
    price <= 0 ||
    (values.minNights.trim() !== '' && minNights === null) ||
    (values.priority.trim() !== '' && priority === null)
  ) {
    return null;
  }

  return {
    name: values.name.trim(),
    dateFrom: values.dateFrom,
    dateTo: values.dateTo,
    nightlyPriceMinor: price,
    minNights,
    priority: priority ?? 0,
  };
}

function useRuleValues(open: boolean, rule: PriceRuleDto | null) {
  const [values, setValues] = useState<RuleValues>(EMPTY);

  useEffect(() => {
    if (open) setValues(valuesFrom(rule));
  }, [open, rule]);

  function change(field: RuleField, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return { values, change };
}

function RuleFields({
  values,
  onChange,
}: {
  values: RuleValues;
  onChange: (field: RuleField, value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <Input
        label={t('hostCalendar.ruleName')}
        value={values.name}
        maxLength={100}
        placeholder={t('hostCalendar.ruleNamePlaceholder')}
        onChange={(event) => onChange('name', event.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('hostCalendar.ruleFrom')}
          type="date"
          value={values.dateFrom}
          onChange={(event) => onChange('dateFrom', event.target.value)}
        />
        <Input
          label={t('hostCalendar.ruleTo')}
          type="date"
          value={values.dateTo}
          onChange={(event) => onChange('dateTo', event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('hostCalendar.nightlyPrice')}
          inputMode="decimal"
          value={values.price}
          onChange={(event) => onChange('price', event.target.value)}
        />
        <Input
          label={t('hostCalendar.priority')}
          inputMode="numeric"
          value={values.priority}
          onChange={(event) => onChange('priority', event.target.value)}
        />
      </div>
      <Input
        label={t('hostCalendar.minNightsOptional')}
        inputMode="numeric"
        value={values.minNights}
        onChange={(event) => onChange('minNights', event.target.value)}
      />
    </div>
  );
}

function RuleError({ validation, error }: { validation: string | null; error: string | null }) {
  const message = validation ?? error;
  if (!message) return null;

  return (
    <p role="alert" className="text-small text-danger">
      {message}
    </p>
  );
}

export function PriceRuleDialog({
  open,
  rule,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  rule: PriceRuleDto | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: PriceRuleInput) => void;
}) {
  const { t } = useTranslation();
  const { values, change } = useRuleValues(open, rule);
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    if (open) setValidation(null);
  }, [open]);

  function submit(): void {
    const input = buildInput(values);
    if (!input) {
      setValidation(t('hostCalendar.validation.required'));
      return;
    }
    if (input.dateTo < input.dateFrom) {
      setValidation(t('hostCalendar.validation.dateTo'));
      return;
    }

    setValidation(null);
    onSubmit(input);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rule ? t('hostCalendar.editRule') : t('hostCalendar.newRule')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('hostCalendar.cancel')}
          </Button>
          <Button onClick={submit} loading={saving} disabled={saving}>
            {t('hostCalendar.saveRule')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <RuleFields values={values} onChange={change} />
        <RuleError validation={validation} error={error} />
      </div>
    </Modal>
  );
}
