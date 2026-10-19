import type { ListingType } from '@staynest/shared';
import { MAX_DESCRIPTION, MAX_LISTING_TITLE } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../../shared/i18n';
import { Input, Select, Textarea } from '../../../shared/ui';
import type { SectionProps } from './form-parts';
import { FormSection } from './form-parts';

const TYPE_OPTIONS: Array<{ value: ListingType; key: TranslationKey }> = [
  { value: 'house', key: 'listings.type.house' },
  { value: 'cottage', key: 'listings.type.cottage' },
  { value: 'cabin', key: 'listings.type.cabin' },
  { value: 'villa', key: 'listings.type.villa' },
  { value: 'townhouse', key: 'listings.type.townhouse' },
];

export function BasicsSection({ state, setField, errors }: SectionProps) {
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
        id="listing-type"
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

export function LocationSection({ state, setField, errors }: SectionProps) {
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
        id="listing-region"
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
