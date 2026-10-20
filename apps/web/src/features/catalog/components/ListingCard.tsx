import type { PublicListingSummary } from '@staynest/shared';
import { House } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '../../../shared/i18n';
import { formatMoney } from '../../../shared/lib/format';
import { FavoriteButton } from '../../favorites/components/FavoriteButton';

function CardPhoto({ listing, eager }: { listing: PublicListingSummary; eager: boolean }) {
  const { t } = useTranslation();
  const cover = listing.coverPhoto;

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
      {cover ? (
        <img
          src={cover.urls.md}
          srcSet={`${cover.urls.thumb} 400w, ${cover.urls.md} 1000w, ${cover.urls.lg} 2000w`}
          sizes="(min-width: 1280px) 360px, (min-width: 768px) 45vw, 100vw"
          alt=""
          width={cover.width}
          height={cover.height}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="size-full object-cover transition-transform duration-panel group-hover:scale-[1.02] motion-reduce:transform-none"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-ink-muted">
          <House className="size-10" aria-hidden="true" strokeWidth={1.5} />
        </span>
      )}

      {listing.photoCount > 1 ? (
        <span className="absolute right-2 bottom-2 rounded-full bg-ink/75 px-2 py-0.5 text-caption font-medium text-bg tabular-nums">
          {t('catalog.card.photoCount', { count: listing.photoCount })}
        </span>
      ) : null}
    </div>
  );
}

export function ListingCard({
  listing,
  eager = false,
}: {
  listing: PublicListingSummary;
  eager?: boolean;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const location = useLocation();
  const price = formatMoney(listing.basePriceMinor, locale, listing.currency);
  const stay = listing.stayPrice;
  const stayPrice = stay ? formatMoney(stay.totalMinor, locale, stay.currency) : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow duration-panel hover:shadow-md">
      <Link
        to={`/listings/${listing.id}`}
        state={{ from: `${location.pathname}${location.search}` }}
        className="flex flex-1 flex-col"
      >
        <CardPhoto listing={listing} eager={eager} />

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <span className="text-caption font-medium tracking-wide text-ink-muted uppercase">
            {t(`listings.type.${listing.type}`)}
          </span>

          <h3 className="line-clamp-2 text-h3 text-ink">{listing.title}</h3>

          <p className="text-small text-ink-muted">
            {[listing.city, listing.region].filter(Boolean).join(', ')}
          </p>

          <p className="text-small text-ink-muted">
            {t('catalog.card.guests', { count: listing.maxGuests })} ·{' '}
            {t('catalog.card.bedrooms', { count: listing.bedrooms })} ·{' '}
            {t('catalog.card.beds', { count: listing.beds })}
          </p>

          <p className="mt-auto pt-2 text-body font-semibold text-ink tabular-nums">
            {stay && stayPrice
              ? t('catalog.card.stayTotal', { price: stayPrice, count: stay.nights })
              : t('catalog.card.perNight', { price })}
          </p>
        </div>
      </Link>

      <FavoriteButton listingId={listing.id} className="absolute top-2 right-2 z-10" />
    </div>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-surface-2 motion-reduce:animate-none" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
        <div className="h-5 w-4/5 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
        <div className="h-4 w-1/2 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
        <div className="mt-2 h-5 w-2/5 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
