import { Luggage } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonClassName } from '../../../shared/ui';
import { useBookings } from '../api/bookings-hooks';
import type { BookingTabItem } from './BookingList';
import { BookingList, BookingTabs, groupByStatus } from './BookingList';
import { statusesOf, TRIP_TABS } from '../model/status';
import type { TripTab } from '../model/status';

const TAB_LABEL_KEYS = {
  upcoming: 'booking.tabs.upcoming',
  past: 'booking.tabs.past',
  cancelled: 'booking.tabs.cancelled',
} as const;

export function TripsView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TripTab>('upcoming');
  const query = useBookings('guest');
  const bookings = query.data?.pages.flatMap((page) => page.bookings) ?? [];

  const tabs: BookingTabItem<TripTab>[] = TRIP_TABS.map((id) => ({
    id,
    label: t(TAB_LABEL_KEYS[id]),
    count: groupByStatus(bookings, statusesOf(id)).length,
  }));

  const visible = groupByStatus(bookings, statusesOf(tab));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink">{t('pages.trips.title')}</h1>
        <p className="text-small text-ink-muted">{t('booking.list.guestSubtitle')}</p>
      </header>

      <BookingTabs tabs={tabs} active={tab} onChange={setTab} />

      <section aria-label={t(TAB_LABEL_KEYS[tab])}>
        <BookingList
          bookings={visible}
          viewer="guest"
          loading={query.isPending}
          error={query.isError}
          onRetry={() => void query.refetch()}
          hasNextPage={query.hasNextPage}
          loadingMore={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          empty={
            <Link to="/" className={buttonClassName()}>
              <Luggage className="size-5" aria-hidden="true" />
              {t('booking.list.findHome')}
            </Link>
          }
        />
      </section>
    </div>
  );
}
