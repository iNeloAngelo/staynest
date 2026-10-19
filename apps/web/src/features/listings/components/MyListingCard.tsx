import type { ListingDto } from '@staynest/shared';
import { ArrowRight, House, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatDate, formatMoney } from '../../../shared/lib/format';
import { useLocale } from '../../../shared/i18n';
import { Badge } from '../../../shared/ui';
import { ListingStatusBadge } from './ListingStatusBadge';

export function MyListingCard({ listing }: { listing: ListingDto }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const title = listing.title?.trim() || t('listings.untitled');
  const cover = listing.photos.find((photo) => photo.isCover) ?? listing.photos[0];

  return (
    <Link
      to={`/host/listings/${listing.id}`}
      className="flex gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm transition-colors duration-micro hover:border-primary sm:gap-4 sm:p-4"
    >
      <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2 text-ink-muted sm:size-24">
        {cover ? (
          <img
            src={cover.urls.thumb}
            alt=""
            width={cover.width}
            height={cover.height}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <House className="size-8" aria-hidden="true" strokeWidth={1.5} />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <ListingStatusBadge status={listing.status} />
          {listing.pendingBookingsCount > 0 ? (
            <Badge tone="warning" icon={<Inbox className="size-3.5" aria-hidden="true" />}>
              {t('listings.pendingCount', { count: listing.pendingBookingsCount })}
            </Badge>
          ) : null}
        </span>

        <span className="line-clamp-2 text-body font-semibold text-ink">{title}</span>

        <span className="text-small text-ink-muted">
          {listing.city?.trim() || t('listings.noCity')}
          {listing.basePriceMinor !== null
            ? ` · ${t('listings.perNight', {
                price: formatMoney(listing.basePriceMinor, locale, listing.currency),
              })}`
            : ''}
        </span>

        <span className="mt-auto flex items-center justify-between gap-2 text-caption text-ink-muted">
          {t('listings.updated', { date: formatDate(listing.updatedAt, locale) })}
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
