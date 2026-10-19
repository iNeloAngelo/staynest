import { useTranslation } from 'react-i18next';
import { formatMoney } from '../../../shared/lib/format';
import { useLocale } from '../../../shared/i18n';
import { Chip, Skeleton, Textarea } from '../../../shared/ui';
import { useAmenities } from '../api/hooks';
import type { SectionProps } from './form-parts';
import { FormSection, NumberField } from './form-parts';

export function ListingPriceSection({ state, setField, errors }: SectionProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const preview = state.basePrice ? Number(state.basePrice) * 100 : null;

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
        />
        <NumberField
          label={t('listings.field.weekendPrice')}
          value={state.weekendPrice}
          error={errors.weekendPrice}
          onChange={(value) => setField('weekendPrice', value)}
          min={1}
        />
        <NumberField
          label={t('listings.field.cleaningFee')}
          value={state.cleaningFee}
          error={errors.cleaningFee}
          onChange={(value) => setField('cleaningFee', value)}
          min={0}
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

export function ListingAmenitiesSection({ state, setField, errors }: SectionProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { data: amenities, isPending, isError, refetch } = useAmenities();

  function toggle(id: number): void {
    const selected = state.amenityIds.includes(id)
      ? state.amenityIds.filter((amenityId) => amenityId !== id)
      : [...state.amenityIds, id];
    setField('amenityIds', selected);
  }

  return (
    <FormSection title={t('listings.section.amenities')}>
      {isPending ? (
        <div className="flex flex-wrap gap-2" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-28 rounded-full" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <p className="text-small text-danger">
          {t('listings.amenities.error')}{' '}
          <button type="button" className="underline" onClick={() => void refetch()}>
            {t('common.retry')}
          </button>
        </p>
      ) : null}

      {amenities ? (
        <div className="flex flex-wrap gap-2">
          {amenities.map((amenity) => (
            <Chip
              key={amenity.id}
              selected={state.amenityIds.includes(amenity.id)}
              onClick={() => toggle(amenity.id)}
            >
              {locale === 'en' ? amenity.nameEn : amenity.nameRu}
            </Chip>
          ))}
        </div>
      ) : null}

      {errors.amenityIds ? <p className="text-small text-danger">{errors.amenityIds}</p> : null}
    </FormSection>
  );
}

export function ListingRulesSection({ state, setField, errors }: SectionProps) {
  const { t } = useTranslation();

  return (
    <FormSection title={t('listings.section.rules')}>
      <Textarea
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
