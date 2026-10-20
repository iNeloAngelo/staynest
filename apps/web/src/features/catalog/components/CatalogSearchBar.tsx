import { Search } from 'lucide-react';
import { useDeferredValue, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, MAX_QUOTE_NIGHTS, nightsBetween } from '@staynest/shared';
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

type DateFieldsProps = {
  checkIn: string;
  checkOut: string;
  error: string | undefined;
  onCheckInChange: (value: string) => void;
  onCheckOutChange: (value: string) => void;
};

type QueryFieldsProps = {
  q: string;
  city: string;
  onQChange: (value: string) => void;
  onCityChange: (value: string) => void;
};

function QueryFields({ q, city, onQChange, onCityChange }: QueryFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="col-span-2 lg:col-span-1">
        <Input
          label={t('catalog.search.q')}
          placeholder={t('catalog.search.qPlaceholder')}
          value={q}
          onChange={(event) => onQChange(event.target.value)}
          suffix={<Search className="size-5 text-ink-muted" aria-hidden="true" />}
          maxLength={120}
        />
      </div>
      <div className="col-span-2 lg:col-span-1">
        <CityField value={city} onChange={onCityChange} />
      </div>
    </>
  );
}

function DateFields({
  checkIn,
  checkOut,
  error,
  onCheckInChange,
  onCheckOutChange,
}: DateFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Input
        label={t('catalog.search.checkIn')}
        type="date"
        value={checkIn}
        max={checkOut || undefined}
        onChange={(event) => onCheckInChange(event.target.value)}
      />
      <Input
        label={t('catalog.search.checkOut')}
        type="date"
        value={checkOut}
        min={checkIn ? addDays(checkIn, 1) : undefined}
        error={error}
        onChange={(event) => onCheckOutChange(event.target.value)}
      />
    </>
  );
}

function GuestField({ filters, onChange }: CatalogSearchBarProps) {
  const { t } = useTranslation();

  return (
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
  );
}

function useSearchState(filters: CatalogFilters) {
  const [q, setQ] = useState(filters.q);
  const [city, setCity] = useState(filters.city);
  const [checkIn, setCheckIn] = useState(filters.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(filters.checkOut ?? '');
  const [dateSubmitted, setDateSubmitted] = useState(false);

  useEffect(() => {
    setQ(filters.q);
    setCity(filters.city);
    setCheckIn(filters.checkIn ?? '');
    setCheckOut(filters.checkOut ?? '');
  }, [filters.q, filters.city, filters.checkIn, filters.checkOut]);

  return {
    q,
    setQ,
    city,
    setCity,
    checkIn,
    setCheckIn,
    checkOut,
    setCheckOut,
    dateSubmitted,
    setDateSubmitted,
  };
}

const DATE_ERROR_KEYS = {
  datesRequired: 'catalog.search.datesRequired',
  dateRangeInvalid: 'catalog.search.dateRangeInvalid',
  dateRangeTooLong: 'catalog.search.dateRangeTooLong',
} as const;

type DateProblem = keyof typeof DATE_ERROR_KEYS;

function dateProblem(checkIn: string, checkOut: string, submitted: boolean): DateProblem | null {
  const incomplete = Boolean(checkIn) !== Boolean(checkOut);
  if (submitted && incomplete) return 'datesRequired';
  if (!checkIn || !checkOut) return null;
  if (checkOut <= checkIn) return 'dateRangeInvalid';
  if (nightsBetween(checkIn, checkOut) > MAX_QUOTE_NIGHTS) return 'dateRangeTooLong';
  return null;
}

export function CatalogSearchBar({ filters, onChange }: CatalogSearchBarProps) {
  const { t } = useTranslation();
  const state = useSearchState(filters);
  const { q, city, checkIn, checkOut, dateSubmitted, setDateSubmitted } = state;

  const problem = dateProblem(checkIn, checkOut, dateSubmitted);
  const dateError = problem ? t(DATE_ERROR_KEYS[problem], { count: MAX_QUOTE_NIGHTS }) : undefined;

  const updateDate = (setter: (value: string) => void) => (value: string) => {
    setDateSubmitted(false);
    setter(value);
  };

  return (
    <form
      role="search"
      aria-label={t('catalog.search.label')}
      className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(9.5rem,0.75fr)_auto] lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        setDateSubmitted(true);

        const submitProblem = dateProblem(checkIn, checkOut, true);
        if (submitProblem) return;
        onChange({
          ...filters,
          q: q.trim(),
          city: city.trim(),
          checkIn: checkIn || null,
          checkOut: checkOut || null,
        });
      }}
    >
      <QueryFields q={q} city={city} onQChange={state.setQ} onCityChange={state.setCity} />

      <DateFields
        checkIn={checkIn}
        checkOut={checkOut}
        error={dateError}
        onCheckInChange={updateDate(state.setCheckIn)}
        onCheckOutChange={updateDate(state.setCheckOut)}
      />

      <GuestField filters={filters} onChange={onChange} />

      <Button
        type="submit"
        size="lg"
        className="col-span-2 w-full self-end lg:col-span-1 lg:w-auto"
      >
        {t('catalog.search.submit')}
      </Button>
    </form>
  );
}
