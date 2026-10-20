import type { DashboardCheckIn } from '@staynest/shared';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocale } from '../../../shared/i18n';
import { formatShortDate } from '../../../shared/lib/dates';

export function UpcomingCheckIns({ checkIns }: { checkIns: DashboardCheckIn[] }) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
      <h2 className="font-serif text-h3 text-ink">{t('hostDashboard.upcomingTitle')}</h2>

      {checkIns.length === 0 ? (
        <p className="flex items-center gap-2 text-small text-ink-muted">
          <CalendarDays className="size-5" aria-hidden="true" strokeWidth={1.75} />
          {t('hostDashboard.upcomingEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {checkIns.map((checkIn) => (
            <li key={checkIn.bookingId}>
              <Link
                to={`/bookings/${checkIn.bookingId}`}
                className="group flex flex-wrap items-baseline justify-between gap-2 py-3"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-body font-medium text-ink group-hover:text-primary">
                    {checkIn.listingTitle}
                  </span>
                  <span className="text-small text-ink-muted">
                    {checkIn.guestName}
                    {checkIn.city ? ` · ${checkIn.city}` : ''}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-0.5 text-small text-ink-muted tabular-nums">
                  <span>
                    {formatShortDate(checkIn.checkIn, locale)} —{' '}
                    {formatShortDate(checkIn.checkOut, locale)}
                  </span>
                  <span>{t('booking.card.guests', { count: checkIn.guestsCount })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
