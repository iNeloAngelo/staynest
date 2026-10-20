import { Inbox, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonClassName } from '../../../shared/ui';
import { useBookings } from '../api/bookings-hooks';
import { HOST_TABS, hostStatusesOf } from '../model/status';
import type { HostTab } from '../model/status';
import type { BookingTabItem } from './BookingList';
import { BookingList, BookingTabs, groupByStatus } from './BookingList';

const TAB_LABEL_KEYS = {
  pending: 'booking.tabs.hostPending',
  confirmed: 'booking.tabs.hostConfirmed',
  completed: 'booking.tabs.hostCompleted',
  closed: 'booking.tabs.hostClosed',
} as const;

export function HostRequestsView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<HostTab>('pending');
  const query = useBookings('host');
  const bookings = query.data?.pages.flatMap((page) => page.bookings) ?? [];

  const tabs: BookingTabItem<HostTab>[] = HOST_TABS.map((id) => ({
    id,
    label: t(TAB_LABEL_KEYS[id]),
    count: groupByStatus(bookings, hostStatusesOf(id)).length,
  }));

  const visible = groupByStatus(bookings, hostStatusesOf(tab));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink">{t('pages.hostRequests.title')}</h1>
        <p className="text-small text-ink-muted">{t('booking.list.hostSubtitle')}</p>
      </header>

      <BookingTabs tabs={tabs} active={tab} onChange={setTab} />

      <section aria-label={t(TAB_LABEL_KEYS[tab])}>
        <BookingList
          bookings={visible}
          viewer="host"
          loading={query.isPending}
          error={query.isError}
          onRetry={() => void query.refetch()}
          hasNextPage={query.hasNextPage}
          loadingMore={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          empty={
            <Link to="/host/listings" className={buttonClassName()}>
              <Plus className="size-5" aria-hidden="true" />
              {t('booking.list.hostEmptyAction')}
            </Link>
          }
        />
      </section>

      <p className="inline-flex items-center gap-2 text-caption text-ink-muted">
        <Inbox className="size-4" aria-hidden="true" />
        {t('booking.list.hostHint')}
      </p>
    </div>
  );
}
