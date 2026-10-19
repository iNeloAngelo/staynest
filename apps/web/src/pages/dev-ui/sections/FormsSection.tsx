import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, Input, NumberStepper, Select, Textarea } from '../../../shared/ui';
import type { SelectOption } from '../../../shared/ui';

const LIMIT = 200;

function TextFieldsDemo() {
  const { t } = useTranslation();
  const [housing, setHousing] = useState('house');
  const [description, setDescription] = useState('');

  const housingOptions: SelectOption[] = [
    { value: 'house', label: t('dev.forms.selectHouse') },
    { value: 'cabin', label: t('dev.forms.selectCabin') },
  ];

  return (
    <>
      <Input
        label={t('dev.forms.input')}
        hint={t('dev.forms.inputHint')}
        defaultValue={t('dev.forms.inputValue')}
      />

      <Input
        label={t('dev.forms.inputError')}
        error={t('dev.forms.inputErrorText')}
        defaultValue=""
      />

      <Input
        label={t('dev.forms.inputDisabled')}
        disabled
        defaultValue={t('dev.forms.inputDisabledValue')}
      />

      <Select
        label={t('dev.forms.select')}
        value={housing}
        onChange={(event) => setHousing(event.target.value)}
        options={housingOptions}
      />

      <div className="sm:col-span-2">
        <Textarea
          label={t('dev.forms.textarea')}
          hint={t('dev.forms.textareaHint')}
          maxLength={LIMIT}
          showCounter
          currentLength={description.length}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </>
  );
}

function ChoiceFieldsDemo() {
  const { t } = useTranslation();
  const [guests, setGuests] = useState(2);
  const [chips, setChips] = useState<string[]>(['forest']);

  function toggleChip(value: string): void {
    setChips((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  return (
    <>
      <NumberStepper
        label={t('dev.forms.stepper')}
        value={guests}
        min={1}
        max={12}
        onChange={setGuests}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-small font-medium text-ink">{t('dev.forms.chips')}</span>
        <div className="flex flex-wrap gap-2">
          <Chip selected={chips.length === 0} onClick={() => setChips([])}>
            {t('dev.forms.chipAll')}
          </Chip>
          <Chip selected={chips.includes('forest')} onClick={() => toggleChip('forest')}>
            {t('dev.forms.chipForest')}
          </Chip>
          <Chip selected={chips.includes('lake')} onClick={() => toggleChip('lake')}>
            {t('dev.forms.chipLake')}
          </Chip>
        </div>
      </div>
    </>
  );
}

export function FormsSection() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="dev-forms" className="flex flex-col gap-4">
      <h2 id="dev-forms" className="text-h2 text-ink">
        {t('dev.section.forms')}
      </h2>

      <div className="grid gap-5 rounded-lg border border-border bg-surface p-4 shadow-sm sm:grid-cols-2 sm:p-6">
        <TextFieldsDemo />
        <ChoiceFieldsDemo />
      </div>
    </section>
  );
}
