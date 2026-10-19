import { SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { Chip } from '../../../shared/ui/Chip';
import { Select } from '../../../shared/ui/Select';
import type { CatalogFilters } from '../model/filters';
import { LISTING_TYPES, effectiveSort, toggleItem } from '../model/filters';

type ControlProps = {
  filters: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
};

export function CatalogSortSelect({ filters, onChange }: ControlProps) {
  const { t } = useTranslation();
  const sort = effectiveSort(filters);
  const hasQuery = filters.q.trim() !== '';
  const defaultSort = hasQuery ? 'relevance' : 'newest';

  const options = [
    ...(hasQuery ? [{ value: 'relevance', label: t('catalog.sort.relevance') }] : []),
    { value: 'newest', label: t('catalog.sort.newest') },
    { value: 'price_asc', label: t('catalog.sort.price_asc') },
    { value: 'price_desc', label: t('catalog.sort.price_desc') },
  ];

  return (
    <Select
      label={t('catalog.sort.label')}
      value={sort}
      onChange={(event) => {
        const value = event.target.value as CatalogFilters['sort'];
        onChange({ ...filters, sort: value === defaultSort ? null : value });
      }}
      options={options}
      className="min-w-44"
    />
  );
}

export function CatalogQuickTypes({ filters, onChange }: ControlProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('catalog.filters.type')}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1"
    >
      {LISTING_TYPES.map((type) => (
        <Chip
          key={type}
          selected={filters.types.includes(type)}
          onClick={() => onChange({ ...filters, types: toggleItem(filters.types, type) })}
          className="shrink-0"
        >
          {t(`listings.type.${type}`)}
        </Chip>
      ))}
    </div>
  );
}

export function CatalogMobileFilterButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <Button
      variant="secondary"
      leftIcon={<SlidersHorizontal className="size-5" aria-hidden="true" />}
      onClick={onClick}
      className="lg:hidden"
    >
      {t('catalog.filters.open')}
    </Button>
  );
}
