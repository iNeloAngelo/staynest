import type { ListingType } from '@staynest/shared';
import { MAX_DESCRIPTION, MAX_LISTING_TITLE } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import { Input, Select, Textarea } from '../../../shared/ui';
import type { TranslationKey } from '../../../shared/i18n';
import type { SectionProps } from './form-parts';
import { FormSection, NumberField } from './form-parts';

const TYPE_OPTIONS: Array<{ value: ListingType; key: TranslationKey }> = [
  { value: 'house', key: 'listings.type.house' },
  { value: 'cottage', key: 'listings.type.cottage' },
  { value: 'cabin', key: 'listings.type.cabin' },
  { value: 'villa', key: 'listings.type.villa' },
  { value: 'townhouse', key: 'listings.type.townhouse' },
];

export function ListingBasicsSection({ state, setField, errors }: SectionProps) {
  const { t } = useTranslation();

  return (
    <FormSection title={t('listings.section.basics')}>
      <Input
        id="listing-title"
        label={t('listings.field.title')}
        hint={t('listings.field.titleHint')}
        error={errors.title}
        value={state.title}
        maxLength={MAX_LISTING_TITLE}
        onChange={(event) => setField('title', event.target.value)}
      />

      <Select
        label={t('listings.field.type')}
        value={state.type}
        options={TYPE_OPTIONS.map((option) => ({ value: option.value, label: t(option.key) }))}
        onChange={(event) => setField('type', event.target.value as ListingType)}
      />

      <Textarea
        id="listing-description"
        label={t('listings.field.description')}
        hint={t('listings.field.descriptionHint')}
        error={errors.description}
        value={state.description}
        maxLength={MAX_DESCRIPTION}
        showCounter
        currentLength={state.description.length}
        onChange={(event) => setField('description', event.target.value)}
      />
    </FormSection>
  );
}

export function ListingLocationSection({ state, setField, errors }: SectionProps) {
  const { t } = useTranslation();

  return (
    <FormSection title={t('listings.section.location')}>
      <Input
        id="listing-city"
        label={t('listings.field.city')}
        error={errors.city}
        value={state.city}
        maxLength={120}
        onChange={(event) => setField('city', event.target.value)}
      />
      <Input
        label={t('listings.field.region')}
        error={errors.region}
        value={state.region}
        maxLength={120}
        onChange={(event) => setField('region', event.target.value)}
      />
      <Input
        id="listing-addressLine"
        label={t('listings.field.addressLine')}
        hint={t('listings.field.addressHint')}
        error={errors.addressLine}
        value={state.addressLine}
        maxLength={300}
        onChange={(event) => setField('addressLine', event.target.value)}
      />
    </FormSection>
  );
}

export function ListingCapacitySection({ state, setField, errors }: SectionProps) {
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
          label={t('listings.field.bathrooms')}
          value={state.bathrooms}
          error={errors.bathrooms}
          onChange={(value) => setField('bathrooms', value)}
          max={20}
        />
        <NumberField
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

export function ListingStaySection({ state, setField, errors }: SectionProps) {
  const { t } = useTranslation();

  return (
    <FormSection title={t('listings.section.stay')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label={t('listings.field.minNights')}
          value={state.minNights}
          error={errors.minNights}
          onChange={(value) => setField('minNights', value)}
          min={1}
          max={365}
        />
        <NumberField
          label={t('listings.field.maxNights')}
          value={state.maxNights}
          error={errors.maxNights}
          onChange={(value) => setField('maxNights', value)}
          min={1}
          max={365}
        />
        <Input
          type="time"
          label={t('listings.field.checkInTime')}
          value={state.checkInTime}
          error={errors.checkInTime}
          onChange={(event) => setField('checkInTime', event.target.value)}
        />
        <Input
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
