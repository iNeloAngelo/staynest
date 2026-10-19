import type { ListingDto } from '@staynest/shared';
import { House, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  MyListingCard,
  listingsErrorKey,
  useCreateListing,
  useMyListings,
} from '../../features/listings';
import { useOnline } from '../../shared/lib/useOnline';
import { Button, EmptyState, Skeleton, useToast } from '../../shared/ui';

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  );
}

function ListingsList({ listings }: { listings: ListingDto[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {listings.map((listing) => (
        <li key={listing.id}>
          <MyListingCard listing={listing} />
        </li>
      ))}
    </ul>
  );
}

type BodyProps = {
  data: ListingDto[] | undefined;
  isPending: boolean;
  isError: boolean;
  creating: boolean;
  online: boolean;
  onCreate: () => void;
  onRetry: () => void;
};

function ListingsBody({
  data,
  isPending,
  isError,
  creating,
  online,
  onCreate,
  onRetry,
}: BodyProps) {
  const { t } = useTranslation();

  if (isPending) return <ListSkeleton />;

  if (isError) {
    return (
      <EmptyState
        icon={<House className="size-6" aria-hidden="true" />}
        title={t('listings.loadErrorTitle')}
        description={t('listings.loadErrorBody')}
        action={
          <Button variant="secondary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<House className="size-6" aria-hidden="true" />}
        title={t('pages.hostListings.emptyTitle')}
        description={t('pages.hostListings.emptyBody')}
        action={
          <Button
            onClick={onCreate}
            loading={creating}
            disabled={!online}
            leftIcon={<Plus className="size-5" aria-hidden="true" />}
          >
            {t('listings.create')}
          </Button>
        }
      />
    );
  }

  return <ListingsList listings={data} />;
}

export function HostListingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const { data, isPending, isError, refetch } = useMyListings();
  const create = useCreateListing();

  async function onCreate(): Promise<void> {
    try {
      const listing = await create.mutateAsync({});
      toast.show({ title: t('listings.created'), tone: 'success' });
      navigate(`/host/listings/${listing.id}`);
    } catch (error) {
      toast.show({ title: t(listingsErrorKey(error)), tone: 'error' });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ink">{t('pages.hostListings.title')}</h1>
          <p className="mt-1 text-small text-ink-muted">
            {data ? t('listings.total', { count: data.length }) : t('common.loading')}
          </p>
        </div>

        <Button
          onClick={() => void onCreate()}
          loading={create.isPending}
          disabled={!online}
          leftIcon={<Plus className="size-5" aria-hidden="true" />}
        >
          {create.isPending ? t('listings.creating') : t('listings.create')}
        </Button>
      </header>

      {!online ? (
        <p
          role="status"
          className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-small text-warning-ink"
        >
          {t('listings.offline')}
        </p>
      ) : null}

      <ListingsBody
        data={data}
        isPending={isPending}
        isError={isError}
        creating={create.isPending}
        online={online}
        onCreate={() => void onCreate()}
        onRetry={() => void refetch()}
      />
    </div>
  );
}
