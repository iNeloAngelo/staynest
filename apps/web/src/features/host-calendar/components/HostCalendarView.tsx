import type { BlockInput } from '@staynest/shared';
import { addDays } from '@staynest/shared';
import { CalendarDays, House } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { TranslationKey } from '../../../shared/i18n';
import { formatIsoDateLocal, todayLocalIso } from '../../../shared/lib/dates';
import { useOnline } from '../../../shared/lib/useOnline';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { useToast } from '../../../shared/ui';
import { useMyListings } from '../../listings';
import { useCreateBlock, useHostCalendar } from '../api/hooks';
import { busyNights } from '../model/calendar';
import { hostErrorText } from '../model/errors';
import { selectRange } from '../../booking/model/selection';
import type { IsoRange, RangeNotice } from '../../booking/model/selection';
import { BlockDialog } from './BlockDialog';
import { HostCalendarContent } from './HostCalendarContent';

const NOTICE_KEYS: Record<RangeNotice, TranslationKey> = {
  busy_start: 'booking.notice.busyStart',
  range_blocked: 'booking.notice.rangeBlocked',
  past: 'booking.notice.past',
};

const HOST_CALENDAR_DAYS_AHEAD = 368;

function HostLoading() {
  const { t } = useTranslation();

  return (
    <div role="status" className="flex flex-col gap-3" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-11 w-full max-w-sm" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}

function HostError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <EmptyState
      titleAs="h1"
      icon={<CalendarDays className="size-6" aria-hidden="true" />}
      title={t('hostCalendar.loadErrorTitle')}
      description={t('hostCalendar.loadErrorBody')}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    />
  );
}

function useHostPageData() {
  const [params, setParams] = useSearchParams();
  const listingsQuery = useMyListings();
  const listings = listingsQuery.data ?? [];
  const requested = params.get('listing');
  const listing = listings.find((item) => item.id === requested) ?? listings[0];
  const [month, setMonth] = useState(() => new Date());
  const today = todayLocalIso();
  const calendarQuery = useHostCalendar(
    listing?.id ?? '',
    addDays(today, -31),
    addDays(today, HOST_CALENDAR_DAYS_AHEAD),
    Boolean(listing),
  );

  return {
    listingsQuery,
    listings,
    listing,
    calendarQuery,
    calendar: calendarQuery.data,
    month,
    setMonth,
    setParams,
  };
}

function useHostSelection(
  listingId: string | undefined,
  calendar: ReturnType<typeof useHostPageData>['calendar'],
) {
  const { t } = useTranslation();
  const toast = useToast();
  const [range, setRange] = useState<IsoRange | undefined>();
  const [notice, setNotice] = useState<RangeNotice | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const createBlock = useCreateBlock(listingId ?? '');

  useEffect(() => {
    setRange(undefined);
    setNotice(null);
  }, [listingId]);

  function handleSelect(date: Date): void {
    if (!calendar) return;
    const result = selectRange(range, formatIsoDateLocal(date), {
      unavailable: busyNights(calendar),
      today: calendar.today,
    });
    setRange(result.range);
    setNotice(result.notice);
    if (result.range?.to) setBlockOpen(true);
  }

  async function submitBlock(input: BlockInput): Promise<void> {
    setBlockError(null);

    try {
      await createBlock.mutateAsync(input);
      toast.show({ title: t('hostCalendar.blockCreated'), tone: 'success' });
      setBlockOpen(false);
      setBlockError(null);
      setRange(undefined);
      setNotice(null);
    } catch (error) {
      setBlockError(hostErrorText(error, t));
    }
  }

  return {
    range,
    notice,
    blockOpen,
    blockError,
    createBlock,
    handleSelect,
    submitBlock,
    closeBlock: () => {
      setBlockOpen(false);
      setBlockError(null);
    },
  };
}

export function HostCalendarView() {
  const { t } = useTranslation();
  const online = useOnline();
  const page = useHostPageData();
  const selection = useHostSelection(page.listing?.id, page.calendar);

  if (page.listingsQuery.isPending) return <HostLoading />;

  if (page.listingsQuery.isError) {
    return <HostError onRetry={() => void page.listingsQuery.refetch()} />;
  }

  if (page.listings.length === 0) {
    return <NoListings />;
  }

  if (!page.listing || page.calendarQuery.isPending) return <HostLoading />;

  if (page.calendarQuery.isError || !page.calendar) {
    return <HostError onRetry={() => void page.calendarQuery.refetch()} />;
  }

  return (
    <>
      <HostCalendarContent
        listings={page.listings}
        listing={page.listing}
        calendar={page.calendar}
        online={online}
        month={page.month}
        range={selection.range}
        notice={selection.notice ? t(NOTICE_KEYS[selection.notice]) : null}
        onListingChange={(id) => page.setParams({ listing: id })}
        onMonthChange={page.setMonth}
        onSelect={selection.handleSelect}
      />

      <BlockDialog
        open={selection.blockOpen}
        range={selection.range}
        saving={selection.createBlock.isPending}
        error={selection.blockError}
        online={online}
        onClose={selection.closeBlock}
        onSubmit={(input) => void selection.submitBlock(input)}
      />
    </>
  );
}

function NoListings() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <EmptyState
      titleAs="h1"
      icon={<House className="size-6" aria-hidden="true" />}
      title={t('hostCalendar.emptyTitle')}
      description={t('hostCalendar.emptyBody')}
      action={
        <Button
          onClick={() => navigate('/host/listings')}
          leftIcon={<CalendarDays className="size-5" aria-hidden="true" />}
        >
          {t('hostCalendar.create')}
        </Button>
      }
    />
  );
}
