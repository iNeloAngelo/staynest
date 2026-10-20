import type { BookingStatus, BookingSummary } from '@staynest/shared';
import { CalendarX } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { useOnline } from '../../../shared/lib/useOnline';
import { BookingCard } from './BookingCard';

export type BookingTabItem<T extends string> = {
  id: T;
  label: string;
  count: number;
};

export function BookingTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: BookingTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  const { t } = useTranslation();
  const current = tabs.findIndex((tab) => tab.id === active);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : step === 0
            ? -1
            : (current + step + tabs.length) % tabs.length;

    if (index < 0 || !tabs[index]) return;

    event.preventDefault();
    onChange(tabs[index].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={t('booking.tabs.label')}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          tabIndex={tab.id === active ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={
            tab.id === active
              ? 'inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 text-small font-semibold text-on-primary'
              : 'inline-flex min-h-11 shrink-0 items-center rounded-full bg-surface-2 px-4 text-small font-medium text-ink-muted hover:text-ink'
          }
        >
          {tab.label}
          <span className="ml-1.5 tabular-nums">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}

export function groupByStatus(
  bookings: BookingSummary[],
  statuses: BookingStatus[],
): BookingSummary[] {
  return bookings.filter((booking) => statuses.includes(booking.status));
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} className="h-44 w-full rounded-lg" />
      ))}
    </div>
  );
}

function ListError({ onRetry, online }: { onRetry: () => void; online: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="text-small text-danger">
        {online ? t('booking.list.error') : t('booking.list.offline')}
      </p>
      <Button variant="secondary" onClick={onRetry} disabled={!online}>
        {t('common.retry')}
      </Button>
    </div>
  );
}

export function BookingList({
  bookings,
  viewer,
  loading,
  error,
  empty,
  onRetry,
  hasNextPage,
  loadingMore,
  onLoadMore,
}: {
  bookings: BookingSummary[];
  viewer: 'guest' | 'host';
  loading: boolean;
  error: boolean;
  empty: ReactNode;
  onRetry: () => void;
  hasNextPage: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useTranslation();
  const online = useOnline();

  if (loading) return online ? <ListSkeleton /> : <ListError onRetry={onRetry} online={false} />;
  if (error) return <ListError onRetry={onRetry} online={online} />;
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState
          icon={<CalendarX className="size-6" aria-hidden="true" />}
          title={t('booking.list.emptyTitle')}
          description={t('booking.list.emptyBody')}
          action={empty}
        />
        {hasNextPage ? (
          <Button variant="secondary" loading={loadingMore} onClick={onLoadMore}>
            {t('booking.list.more')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} viewer={viewer} />
      ))}

      {hasNextPage ? (
        <Button variant="secondary" loading={loadingMore} onClick={onLoadMore}>
          {t('booking.list.more')}
        </Button>
      ) : null}
    </div>
  );
}
