import type { BookingDetail } from '@staynest/shared';
import { CalendarDays, MapPin, MessageSquare, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocale } from '../../../shared/i18n';
import { formatDateTime, formatLongDate } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/format';
import { buttonClassName } from '../../../shared/ui/buttonStyles';
import { BookingStatusBadge } from './BookingStatusBadge';
import { QuoteSummary } from './QuoteSummary';

export function bookingRoleOf(
  booking: BookingDetail,
  userId: string | undefined,
): 'guest' | 'host' {
  return userId === booking.guestId ? 'guest' : 'host';
}

function BookingFacts({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  return (
    <dl className="flex flex-col gap-2 text-body text-ink">
      {booking.listing.city ? (
        <div className="inline-flex items-center gap-2">
          <MapPin className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
          <dt className="sr-only">{t('booking.detail.city')}</dt>
          <dd>{booking.listing.city}</dd>
        </div>
      ) : null}

      <div className="inline-flex items-center gap-2">
        <CalendarDays className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
        <dt className="sr-only">{t('booking.detail.dates')}</dt>
        <dd>
          {formatLongDate(booking.checkIn, locale)} — {formatLongDate(booking.checkOut, locale)}
          <span className="text-ink-muted">
            {' '}
            · {t('booking.nights', { count: booking.nights })}
          </span>
        </dd>
      </div>

      <div className="inline-flex items-center gap-2">
        <Users className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
        <dt className="sr-only">{t('booking.guests')}</dt>
        <dd>{t('booking.card.guests', { count: booking.guestsCount })}</dd>
      </div>
    </dl>
  );
}

export function BookingHeading({
  booking,
  role,
}: {
  booking: BookingDetail;
  role: 'guest' | 'host';
}) {
  const { t, i18n } = useTranslation();
  const { locale } = useLocale();
  const back = role === 'guest' ? '/trips' : '/host/requests';

  return (
    <header className="flex flex-col gap-3">
      <Link
        to={back}
        className="inline-flex min-h-11 items-center text-small font-medium text-primary hover:text-primary-hover"
      >
        ← {t(role === 'guest' ? 'booking.detail.backTrips' : 'booking.detail.backRequests')}
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <BookingStatusBadge status={booking.status} />
        <span className="text-caption text-ink-muted">
          {t('booking.detail.created', {
            date: formatDateTime(booking.createdAt, i18n.language),
          })}
        </span>
      </div>

      {booking.status === 'pending' && booking.expiresAt ? (
        <p className="text-small font-medium text-warning-ink">
          {t(
            role === 'guest' ? 'booking.detail.replyDeadline' : 'booking.detail.replyDeadlineHost',
            {
              date: formatDateTime(booking.expiresAt, i18n.language),
            },
          )}
        </p>
      ) : null}

      <h1 className="text-h1 text-ink">{booking.listing.title}</h1>
      <BookingFacts booking={booking} />

      <p className="text-h2 text-ink tabular-nums">
        {formatMoney(booking.totalMinor, locale, booking.currency)}
      </p>
    </header>
  );
}

export function CreatedNotice({
  booking,
  role,
}: {
  booking: BookingDetail;
  role: 'guest' | 'host';
}) {
  const { t, i18n } = useTranslation();

  if (role !== 'guest' || booking.status !== 'pending') return null;

  return (
    <section className="rounded-lg border border-success/30 bg-success/8 p-4">
      <h2 className="text-h3 text-ink">{t('booking.created.title')}</h2>
      <p className="mt-1 text-small text-ink-muted">
        {booking.expiresAt
          ? t('booking.created.deadline', {
              date: formatDateTime(booking.expiresAt, i18n.language),
            })
          : t('booking.created.body')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/trips" className={buttonClassName()}>
          {t('booking.created.trips')}
        </Link>
        <Link to="/" className={buttonClassName({ variant: 'secondary' })}>
          {t('booking.created.searchMore')}
        </Link>
      </div>
    </section>
  );
}

export function BookingPrice({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 text-h3 text-ink">{t('booking.detail.price')}</h2>
      <QuoteSummary quote={booking.priceBreakdown} loading={false} error={undefined} />
      <p className="mt-2 text-caption text-ink-muted">{t('booking.detail.priceSnapshot')}</p>
    </section>
  );
}

function ContactRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-small text-ink-muted">{label}</dt>
      <dd className="text-small font-medium text-ink">
        {href ? (
          <a
            href={href}
            className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function BookingContacts({
  booking,
  role,
}: {
  booking: BookingDetail;
  role: 'guest' | 'host';
}) {
  const { t } = useTranslation();

  if (!booking.contacts) return null;

  const phone = role === 'guest' ? booking.contacts.hostPhone : booking.contacts.guestPhone;
  const phoneLabel =
    role === 'guest' ? t('booking.detail.hostPhone') : t('booking.detail.guestPhone');

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-h3 text-ink">{t('booking.detail.contactsTitle')}</h2>
      <p className="mt-1 mb-3 text-small text-ink-muted">
        {t(
          booking.status === 'completed'
            ? 'booking.detail.contactsBodyCompleted'
            : 'booking.detail.contactsBody',
        )}
      </p>
      <dl className="flex flex-col gap-2">
        {booking.contacts.addressLine ? (
          <ContactRow label={t('booking.detail.address')} value={booking.contacts.addressLine} />
        ) : null}
        <ContactRow
          label={phoneLabel}
          value={phone ?? t('booking.detail.phoneMissing')}
          {...(phone ? { href: `tel:${phone.replace(/[^\d+]/g, '')}` } : {})}
        />
      </dl>
    </section>
  );
}

export function BookingMessages({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();

  if (!booking.guestMessage && !booking.hostResponse && !booking.cancelReason) return null;

  return (
    <section className="flex flex-col gap-3">
      {booking.guestMessage ? (
        <div className="rounded-lg bg-surface-2 p-4">
          <h2 className="inline-flex items-center gap-2 text-h3 text-ink">
            <MessageSquare className="size-5" aria-hidden="true" />
            {t('booking.detail.guestMessage')}
          </h2>
          <p className="mt-2 whitespace-pre-line text-body text-ink">{booking.guestMessage}</p>
        </div>
      ) : null}

      {booking.hostResponse ? (
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-h3 text-ink">{t('booking.detail.hostResponse')}</h2>
          <p className="mt-2 whitespace-pre-line text-body text-ink">{booking.hostResponse}</p>
        </div>
      ) : null}

      {booking.cancelReason ? (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <h2 className="text-h3 text-ink">{t('booking.detail.cancelReason')}</h2>
          <p className="mt-2 whitespace-pre-line text-body text-ink">{booking.cancelReason}</p>
        </div>
      ) : null}
    </section>
  );
}
