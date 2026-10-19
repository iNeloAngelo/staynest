import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CatalogFilters } from './filters';
import { EMPTY_FILTERS, filtersToSearchParams, parseCatalogFilters } from './filters';

export type CatalogFiltersController = {
  filters: CatalogFilters;
  update: (next: CatalogFilters) => void;
  reset: () => void;
};

export function useCatalogFilters(): CatalogFiltersController {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseCatalogFilters(params), [params]);

  const update = useCallback(
    (next: CatalogFilters) => {
      setParams(filtersToSearchParams(next), { replace: true });
    },
    [setParams],
  );

  const reset = useCallback(() => {
    setParams(filtersToSearchParams(EMPTY_FILTERS), { replace: true });
  }, [setParams]);

  return { filters, update, reset };
}
