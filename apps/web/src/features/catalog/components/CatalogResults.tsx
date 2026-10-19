import type { PublicListingSummary } from '@staynest/shared';
import { SearchX, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useOnline } from '../../../shared/lib/useOnline';
import type { useCatalog } from '../api/hooks';
import { ListingCard, ListingCardSkeleton } from './ListingCard';
import { useInfiniteScroll } from '../model/useInfiniteScroll';

type CatalogResultsProps = {
  query: ReturnType<typeof useCatalog>;
  filtersActive: boolean;
  onReset: () => void;
};

function LoadingGrid() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-label={t('catalog.loading')}
      aria-busy="true"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <span className="sr-only">{t('catalog.loading')}</span>
      {Array.from({ length: 6 }, (_, index) => (
        <ListingCardSkeleton key={index} />
      ))}
    </div>
  );
}

function ErrorState({ onRetry, online }: { onRetry: () => void; online: boolean }) {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={<WifiOff className="size-6" aria-hidden="true" />}
      title={online ? t('catalog.results.errorTitle') : t('catalog.results.offlineTitle')}
      description={online ? t('catalog.results.errorBody') : t('catalog.results.offlineBody')}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    />
  );
}

function EmptyResult({ filtersActive, onReset }: Omit<CatalogResultsProps, 'query'>) {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={<SearchX className="size-6" aria-hidden="true" />}
      title={t('catalog.results.emptyTitle')}
      description={t('catalog.results.emptyBody')}
      action={
        filtersActive ? (
          <Button variant="secondary" onClick={onReset}>
            {t('catalog.filters.reset')}
          </Button>
        ) : undefined
      }
    />
  );
}

function ListingGrid({ listings }: { listings: PublicListingSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing, index) => (
        <ListingCard key={listing.id} listing={listing} eager={index < 3} />
      ))}
    </div>
  );
}

export function CatalogResults({ query, filtersActive, onReset }: CatalogResultsProps) {
  const { t } = useTranslation();
  const online = useOnline();
  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  });

  if (query.isPending) return <LoadingGrid />;
  if (query.isError) {
    return <ErrorState online={online} onRetry={() => void query.refetch()} />;
  }

  const listings = query.data?.pages.flatMap((page) => page.listings) ?? [];
  if (listings.length === 0) {
    return <EmptyResult filtersActive={filtersActive} onReset={onReset} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {!online ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-small text-ink-muted"
        >
          <WifiOff className="size-4" aria-hidden="true" />
          {t('catalog.results.offline')}
        </p>
      ) : null}

      <ListingGrid listings={listings} />
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage
              ? t('catalog.results.loadingMore')
              : t('catalog.results.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
