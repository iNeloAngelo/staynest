import type { PublicListingSummary } from '@staynest/shared';
import { Heart, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useOnline } from '../../../shared/lib/useOnline';
import { Button, EmptyState, textLink } from '../../../shared/ui';
import { ListingCard, ListingCardSkeleton } from '../../catalog/components/ListingCard';
import { useFavorites } from '../api/hooks';

function SkeletonGrid() {
  return (
    <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <ListingCardSkeleton key={index} />
      ))}
    </div>
  );
}

function FavoritesGrid({ listings }: { listings: PublicListingSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing, index) => (
        <ListingCard key={listing.id} listing={listing} eager={index < 3} />
      ))}
    </div>
  );
}

function OfflineNotice() {
  const { t } = useTranslation();

  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-small text-ink-muted"
    >
      <WifiOff className="size-4" aria-hidden="true" />
      {t('favorites.offline')}
    </p>
  );
}

export function FavoritesView() {
  const { t } = useTranslation();
  const online = useOnline();
  const query = useFavorites();
  const listings = query.data?.pages.flatMap((page) => page.listings) ?? [];

  if (query.isPending) return <SkeletonGrid />;

  if (query.isError) {
    return (
      <EmptyState
        icon={<WifiOff className="size-6" aria-hidden="true" />}
        title={online ? t('favorites.loadErrorTitle') : t('favorites.offlineTitle')}
        description={online ? t('favorites.loadErrorBody') : t('favorites.offlineBody')}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  if (listings.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="size-6" aria-hidden="true" />}
        title={t('pages.favorites.emptyTitle')}
        description={t('pages.favorites.emptyBody')}
        action={
          <Link to="/" className={textLink}>
            {t('favorites.toCatalog')}
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!online ? <OfflineNotice /> : null}
      <FavoritesGrid listings={listings} />

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? t('favorites.loadingMore') : t('favorites.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
