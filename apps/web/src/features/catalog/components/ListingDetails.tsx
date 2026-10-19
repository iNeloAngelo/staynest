import type { PublicListing } from '@staynest/shared';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '../../../shared/api';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useListing } from '../api/hooks';
import { PhotoGallery } from './PhotoGallery';
import {
  Amenities,
  Description,
  DetailsSkeleton,
  Facts,
  LocationSection,
  MobilePriceBar,
  PriceBlock,
} from './ListingDetailsSections';

function ListingContent({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation();
  const location = useLocation();
  const state = location.state as { from?: unknown } | null;
  const from = typeof state?.from === 'string' && state.from.startsWith('/') ? state.from : '/';

  return (
    <article className="flex flex-col gap-6 pb-24 lg:pb-0">
      <Link
        to={from}
        className="inline-flex w-fit items-center gap-1.5 text-small font-medium text-primary hover:text-primary-hover"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('listing.back')}
      </Link>

      <header className="flex flex-col gap-2">
        <p className="text-small font-semibold tracking-wide text-primary uppercase">
          {t(`listings.type.${listing.type}`)}
        </p>
        <h1 className="text-h1 text-ink lg:text-h1-lg">{listing.title}</h1>
        <p className="text-body text-ink-muted">
          {[listing.city, listing.region].filter(Boolean).join(', ')}
        </p>
        <Facts listing={listing} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <PhotoGallery photos={listing.photos} title={listing.title} />
          <Description text={listing.description} />
          <Amenities amenities={listing.amenities} />

          <section className="flex flex-col gap-2">
            <h2 className="text-h2 text-ink">{t('listing.rules')}</h2>
            <p className="max-w-prose whitespace-pre-line text-body text-ink">
              {listing.houseRules?.trim() || t('listing.rulesEmpty')}
            </p>
          </section>

          <LocationSection listing={listing} />
        </div>

        <PriceBlock listing={listing} />
      </div>

      <MobilePriceBar listing={listing} />
    </article>
  );
}

export function ListingDetails({ id }: { id: string }) {
  const { t } = useTranslation();
  const { data, isPending, isError, error, refetch } = useListing(id);

  if (isPending) return <DetailsSkeleton />;

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;

    return (
      <EmptyState
        titleAs="h1"
        icon={<MapPin className="size-6" aria-hidden="true" />}
        title={notFound ? t('listing.notFoundTitle') : t('listing.errorTitle')}
        description={notFound ? t('listing.notFoundBody') : t('listing.errorBody')}
        action={
          notFound ? (
            <Link
              to="/"
              className="text-small font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t('listing.back')}
            </Link>
          ) : (
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          )
        }
      />
    );
  }

  return <ListingContent listing={data} />;
}
