import { useTranslation } from 'react-i18next';
import { useLocale } from '../../../shared/i18n';
import { Chip, Skeleton } from '../../../shared/ui';
import { useAmenities } from '../../listings';
import type { SectionProps } from './form-parts';
import { FormSection, NumberField } from './form-parts';

export function CapacitySection({ state, setField, errors }: SectionProps) {
  const { t } = useTranslation();

  return (
    <FormSection title={t('listings.section.capacity')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          id="listing-maxGuests"
          label={t('listings.field.maxGuests')}
          value={state.maxGuests}
          error={errors.maxGuests}
          onChange={(value) => setField('maxGuests', value)}
          min={1}
          max={30}
        />
        <NumberField
          id="listing-bedrooms"
          label={t('listings.field.bedrooms')}
          value={state.bedrooms}
          error={errors.bedrooms}
          onChange={(value) => setField('bedrooms', value)}
          max={20}
        />
        <NumberField
          id="listing-beds"
          label={t('listings.field.beds')}
          value={state.beds}
          error={errors.beds}
          onChange={(value) => setField('beds', value)}
          min={1}
          max={40}
        />
        <NumberField
          id="listing-bathrooms"
          label={t('listings.field.bathrooms')}
          value={state.bathrooms}
          error={errors.bathrooms}
          onChange={(value) => setField('bathrooms', value)}
          max={20}
        />
        <NumberField
          id="listing-areaSqm"
          label={t('listings.field.areaSqm')}
          value={state.areaSqm}
          error={errors.areaSqm}
          onChange={(value) => setField('areaSqm', value)}
          min={1}
          max={2000}
        />
      </div>
    </FormSection>
  );
}

export function AmenitiesSection({ state, setField, errors }: SectionProps) {
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

      {amenities && amenities.length === 0 ? (
        <p className="text-small text-ink-muted">{t('listings.amenities.empty')}</p>
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
