import { Search } from 'lucide-react';
import { useDeferredValue, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { useCitySuggestions } from '../api/hooks';
import type { CatalogFilters } from '../model/filters';

type CatalogSearchBarProps = {
  filters: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
};

const GUEST_OPTIONS = Array.from({ length: 30 }, (_, index) => index + 1);

function CityField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const deferred = useDeferredValue(value);
  const suggestions = useCitySuggestions(deferred);
  const listId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        label={t('catalog.search.city')}
        placeholder={t('catalog.search.cityPlaceholder')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list={listId}
        autoComplete="off"
        maxLength={120}
      />
      <datalist id={listId} aria-label={t('catalog.search.citySuggestions')}>
        {(suggestions.data ?? []).map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}

export function CatalogSearchBar({ filters, onChange }: CatalogSearchBarProps) {
  const { t } = useTranslation();
  const [q, setQ] = useState(filters.q);
  const [city, setCity] = useState(filters.city);

  useEffect(() => {
    setQ(filters.q);
    setCity(filters.city);
  }, [filters.q, filters.city]);

  return (
    <form
      role="search"
      aria-label={t('catalog.search.label')}
      className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ ...filters, q: q.trim(), city: city.trim() });
      }}
    >
      <div>
        <Input
          label={t('catalog.search.q')}
          placeholder={t('catalog.search.qPlaceholder')}
          value={q}
          onChange={(event) => setQ(event.target.value)}
          suffix={<Search className="size-5 text-ink-muted" aria-hidden="true" />}
          maxLength={120}
        />
      </div>

      <div>
        <CityField value={city} onChange={setCity} />
      </div>

      <Select
        label={t('catalog.search.guests')}
        value={filters.guests ?? ''}
        onChange={(event) =>
          onChange({
            ...filters,
            guests: event.target.value ? Number(event.target.value) : null,
          })
        }
        options={[
          { value: '', label: t('catalog.search.anyGuests') },
          ...GUEST_OPTIONS.map((count) => ({
            value: String(count),
            label: t('catalog.search.guestOption', { count }),
          })),
        ]}
      />

      <Button type="submit" size="lg" className="w-full self-end lg:w-auto">
        {t('catalog.search.submit')}
      </Button>
    </form>
  );
}
