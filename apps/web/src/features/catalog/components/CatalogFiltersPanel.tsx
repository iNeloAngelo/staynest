import type { AmenityDto } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import { useAmenities } from '../../listings';
import { Button } from '../../../shared/ui/Button';
import { Chip } from '../../../shared/ui/Chip';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { inputToMinor, minorToInput } from '../../../shared/lib/format';
import type { CatalogFilters } from '../model/filters';
import { LISTING_TYPES, toggleItem } from '../model/filters';

type CatalogFiltersPanelProps = {
  filters: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
  onReset: () => void;
};

type PriceSectionProps = Pick<CatalogFiltersPanelProps, 'filters' | 'onChange'>;

function PriceSection({ filters, onChange }: PriceSectionProps) {
  const { t } = useTranslation();
  const invalidRange =
    filters.priceMin !== null && filters.priceMax !== null && filters.priceMin > filters.priceMax;
  const error = invalidRange ? t('catalog.filters.priceRangeInvalid') : undefined;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-small font-semibold text-ink">
        {t('catalog.filters.price')}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label={t('catalog.filters.priceMin')}
          type="text"
          inputMode="decimal"
          value={minorToInput(filters.priceMin)}
          error={error}
          onChange={(event) => onChange({ ...filters, priceMin: inputToMinor(event.target.value) })}
        />
        <Input
          label={t('catalog.filters.priceMax')}
          type="text"
          inputMode="decimal"
          value={minorToInput(filters.priceMax)}
          error={error}
          onChange={(event) => onChange({ ...filters, priceMax: inputToMinor(event.target.value) })}
        />
      </div>
    </fieldset>
  );
}

function capacityOptions(max: number, anyLabel: string) {
  return [
    { value: '', label: anyLabel },
    ...Array.from({ length: max }, (_, index) => ({
      value: String(index + 1),
      label: String(index + 1),
    })),
  ];
}

function CapacitySection({ filters, onChange }: PriceSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        label={t('catalog.filters.guestsShort')}
        hint={t('catalog.filters.minimum')}
        value={filters.guests ?? ''}
        onChange={(event) =>
          onChange({ ...filters, guests: event.target.value ? Number(event.target.value) : null })
        }
        options={capacityOptions(30, t('catalog.filters.any'))}
      />
      <Select
        label={t('catalog.filters.bedroomsShort')}
        hint={t('catalog.filters.minimum')}
        value={filters.bedroomsMin ?? ''}
        onChange={(event) =>
          onChange({
            ...filters,
            bedroomsMin: event.target.value ? Number(event.target.value) : null,
          })
        }
        options={capacityOptions(20, t('catalog.filters.any'))}
      />
    </div>
  );
}

function TypeSection({ filters, onChange }: PriceSectionProps) {
  const { t } = useTranslation();

  return (
    <fieldset>
      <legend className="mb-2 text-small font-semibold text-ink">
        {t('catalog.filters.type')}
      </legend>
      <div className="flex flex-wrap gap-2">
        {LISTING_TYPES.map((type) => (
          <Chip
            key={type}
            selected={filters.types.includes(type)}
            onClick={() => onChange({ ...filters, types: toggleItem(filters.types, type) })}
          >
            {t(`listings.type.${type}`)}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

function AmenitySection({ filters, onChange }: PriceSectionProps) {
  const { t, i18n } = useTranslation();
  const amenities = useAmenities();

  return (
    <fieldset>
      <legend className="mb-1 text-small font-semibold text-ink">
        {t('catalog.filters.amenities')}
      </legend>
      <p className="mb-2 text-caption text-ink-muted">{t('catalog.filters.amenitiesHint')}</p>

      {amenities.isPending ? (
        <p className="text-small text-ink-muted">{t('common.loading')}</p>
      ) : null}
      {amenities.isError ? (
        <p role="alert" className="text-small text-danger">
          {t('listings.amenities.error')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(amenities.data ?? []).map((amenity) => (
          <Chip
            key={amenity.id}
            selected={filters.amenities.includes(amenity.id)}
            onClick={() =>
              onChange({ ...filters, amenities: toggleItem(filters.amenities, amenity.id) })
            }
          >
            {amenityName(amenity, i18n.language)}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

function amenityName(amenity: AmenityDto, language: string): string {
  return language.startsWith('en') ? amenity.nameEn : amenity.nameRu;
}

export function CatalogFiltersPanel({ filters, onChange, onReset }: CatalogFiltersPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <PriceSection filters={filters} onChange={onChange} />
      <CapacitySection filters={filters} onChange={onChange} />
      <TypeSection filters={filters} onChange={onChange} />
      <AmenitySection filters={filters} onChange={onChange} />

      <Button type="button" variant="ghost" onClick={onReset}>
        {t('catalog.filters.reset')}
      </Button>
    </div>
  );
}
