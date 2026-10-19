import { useTranslation } from 'react-i18next';
import { useLocale } from '../../../shared/i18n';
import { formatMoney, inputToMinor } from '../../../shared/lib/format';
import { Input, Textarea } from '../../../shared/ui';
import type { SectionProps } from './form-parts';
import { FormSection, NumberField } from './form-parts';

export function PriceSection({ state, setField, errors }: SectionProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const preview = state.basePrice ? inputToMinor(state.basePrice) : null;

  return (
    <FormSection title={t('listings.section.prices')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          id="listing-basePrice"
          label={t('listings.field.basePrice')}
          value={state.basePrice}
          error={errors.basePrice}
          onChange={(value) => setField('basePrice', value)}
          min={1}
          step="0.01"
          inputMode="decimal"
        />
        <NumberField
          id="listing-weekendPrice"
          label={t('listings.field.weekendPrice')}
          value={state.weekendPrice}
          error={errors.weekendPrice}
          onChange={(value) => setField('weekendPrice', value)}
          min={1}
          step="0.01"
          inputMode="decimal"
        />
        <NumberField
          id="listing-cleaningFee"
          label={t('listings.field.cleaningFee')}
          value={state.cleaningFee}
          error={errors.cleaningFee}
          onChange={(value) => setField('cleaningFee', value)}
          min={0}
          step="0.01"
          inputMode="decimal"
        />
      </div>

      {preview !== null && Number.isFinite(preview) && preview > 0 ? (
        <p className="rounded-md bg-surface-2 px-3 py-2 text-small text-ink-muted">
          {t('listings.preview', { price: formatMoney(preview, locale) })}
        </p>
      ) : null}
    </FormSection>
  );
}

export function StaySection({ state, setField, errors }: SectionProps) {
  const { t } = useTranslation();

  return (
    <FormSection title={t('listings.section.stay')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          id="listing-minNights"
          label={t('listings.field.minNights')}
          value={state.minNights}
          error={errors.minNights}
          onChange={(value) => setField('minNights', value)}
          min={1}
          max={365}
        />
        <NumberField
          id="listing-maxNights"
          label={t('listings.field.maxNights')}
          value={state.maxNights}
          error={errors.maxNights}
          onChange={(value) => setField('maxNights', value)}
          min={1}
          max={365}
        />
        <Input
          id="listing-checkInTime"
          type="time"
          label={t('listings.field.checkInTime')}
          value={state.checkInTime}
          error={errors.checkInTime}
          onChange={(event) => setField('checkInTime', event.target.value)}
        />
        <Input
          id="listing-checkOutTime"
          type="time"
          label={t('listings.field.checkOutTime')}
          value={state.checkOutTime}
          error={errors.checkOutTime}
          onChange={(event) => setField('checkOutTime', event.target.value)}
        />
      </div>
    </FormSection>
  );
}

export function RulesSection({ state, setField, errors }: SectionProps) {
  const { t } = useTranslation();

  return (
    <FormSection title={t('listings.section.rules')}>
      <Textarea
        id="listing-houseRules"
        label={t('listings.field.houseRules')}
        hint={t('listings.field.houseRulesHint')}
        error={errors.houseRules}
        value={state.houseRules}
        maxLength={2000}
        showCounter
        currentLength={state.houseRules.length}
        onChange={(event) => setField('houseRules', event.target.value)}
      />
    </FormSection>
  );
}
