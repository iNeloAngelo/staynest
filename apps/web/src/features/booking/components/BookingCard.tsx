import type { BookingSummary } from '@staynest/shared';
import { ImageOff, MapPin, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocale } from '../../../shared/i18n';
import { formatShortDate } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/format';
import { canGuestCancel, canHostCancel, canHostDecide } from '../model/status';
import { BookingActions } from './BookingActions';
import { BookingStatusBadge } from './BookingStatusBadge';

function Cover({ url, title }: { url: string | null; title: string }) {
  if (!url) {
    return (
      <span className="flex h-24 w-28 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-muted">
        <ImageOff className="size-6" aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={title}
      width={160}
      height={120}
      loading="lazy"
      className="h-24 w-28 shrink-0 rounded-md object-cover"
    />
  );
}

function BookingMeta({ booking, viewer }: { booking: BookingSummary; viewer: 'guest' | 'host' }) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 text-h3 text-ink">{booking.listing.title}</h2>
        <BookingStatusBadge status={booking.status} />
      </div>

      {viewer === 'host' ? (
        <p className="inline-flex items-center gap-1 text-small text-ink">
          <UserRound className="size-4 text-ink-muted" aria-hidden="true" />
          {t('booking.card.guest', { name: booking.guest.displayName })}
        </p>
      ) : null}

      {booking.listing.city ? (
        <p className="inline-flex items-center gap-1 text-small text-ink-muted">
          <MapPin className="size-4" aria-hidden="true" />
          {booking.listing.city}
        </p>
      ) : null}

      <p className="text-small text-ink">
        {formatShortDate(booking.checkIn, locale)} — {formatShortDate(booking.checkOut, locale)}
      </p>

      <p className="text-small text-ink-muted">
        {t('booking.card.guests', { count: booking.guestsCount })} ·{' '}
        {t('booking.nights', { count: booking.nights })}
      </p>

      <p className="text-body font-semibold text-ink tabular-nums">
        {formatMoney(booking.totalMinor, locale, booking.currency)}
      </p>
    </div>
  );
}

export function BookingCard({
  booking,
  viewer,
}: {
  booking: BookingSummary;
  viewer: 'guest' | 'host';
}) {
  const actionable =
    viewer === 'guest'
      ? canGuestCancel(booking.status)
      : canHostDecide(booking.status) || canHostCancel(booking.status);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <Link
        to={`/bookings/${booking.id}`}
        className="flex gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        <Cover url={booking.listing.coverPhotoUrl} title={booking.listing.title} />
        <BookingMeta booking={booking} viewer={viewer} />
      </Link>

      {booking.guestMessage ? (
        <p className="line-clamp-2 rounded-md bg-surface-2 px-3 py-2 text-small text-ink-muted">
          {booking.guestMessage}
        </p>
      ) : null}

      {actionable ? (
        <div className="border-t border-border pt-3">
          <BookingActions booking={booking} role={viewer} />
        </div>
      ) : null}
    </article>
  );
}
