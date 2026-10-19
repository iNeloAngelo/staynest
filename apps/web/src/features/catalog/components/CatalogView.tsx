import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../../shared/ui/BottomSheet';
import { Button } from '../../../shared/ui/Button';
import { useCatalog } from '../api/hooks';
import { CatalogFiltersPanel } from './CatalogFiltersPanel';
import { CatalogMobileFilterButton, CatalogQuickTypes, CatalogSortSelect } from './CatalogControls';
import { CatalogResults } from './CatalogResults';
import { CatalogSearchBar } from './CatalogSearchBar';
import { hasActiveFilters } from '../model/filters';
import { useCatalogFilters } from '../model/useCatalogFilters';

function CatalogHeader() {
  const { t } = useTranslation();

  return (
    <header className="flex max-w-2xl flex-col gap-2 sm:gap-3">
      <p className="hidden text-small font-semibold tracking-wide text-primary uppercase sm:block">
        {t('home.guest.eyebrow')}
      </p>
      <h1 className="text-h1 text-ink sm:text-display lg:text-display-lg">
        {t('home.guest.title')}
      </h1>
      <p className="hidden text-body text-ink-muted sm:block lg:text-h3">
        {t('home.guest.subtitle')}
      </p>
    </header>
  );
}

export function CatalogView() {
  const { t } = useTranslation();
  const { filters, update, reset } = useCatalogFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = useCatalog(filters);
  const loaded = query.data?.pages.reduce((total, page) => total + page.listings.length, 0) ?? 0;
  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader />

      <CatalogSearchBar filters={filters} onChange={update} />
      <CatalogQuickTypes filters={filters} onChange={update} />

      <div className="flex items-start gap-8">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-24 rounded-lg border border-border bg-surface p-4 shadow-sm">
            <h2 className="mb-4 text-h3 text-ink">{t('catalog.filters.title')}</h2>
            <CatalogFiltersPanel filters={filters} onChange={update} onReset={reset} />
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <h2 className="sr-only">{t('catalog.results.title')}</h2>

          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <CatalogMobileFilterButton onClick={() => setFiltersOpen(true)} />
            <div className="lg:ml-auto">
              <CatalogSortSelect filters={filters} onChange={update} />
            </div>
          </div>

          {loaded > 0 ? (
            <p className="mb-4 text-small text-ink-muted" aria-live="polite">
              {t('catalog.results.showing', { count: loaded })}
            </p>
          ) : null}

          <CatalogResults query={query} filtersActive={filtersActive} onReset={reset} />
        </section>
      </div>

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('catalog.filters.title')}
        fullHeight
        footer={
          <Button fullWidth size="lg" onClick={() => setFiltersOpen(false)}>
            {t('catalog.filters.apply')}
          </Button>
        }
      >
        <CatalogFiltersPanel filters={filters} onChange={update} onReset={reset} />
      </BottomSheet>
    </div>
  );
}
