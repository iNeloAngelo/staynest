import type { PublicListing } from '@staynest/shared';
import type { TFunction } from 'i18next';
import type { DateRange } from 'react-day-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../../shared/i18n';
import { formatIsoDateLocal, formatLongDate, parseIsoDateLocal } from '../../../shared/lib/dates';
import { Button } from '../../../shared/ui/Button';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { useListingCalendar, useQuote } from '../api/hooks';
import {
  rangeIsQuoteable,
  rangeNights,
  rangeProblem,
  selectRange,
  unavailableSet,
} from '../model/selection';
import type { IsoRange, RangeNotice } from '../model/selection';
import { BookingCalendar } from './BookingCalendar';
import { QuoteSummary } from './QuoteSummary';

const NOTICE_KEYS: Record<RangeNotice, TranslationKey> = {
  busy_start: 'booking.notice.busyStart',
  range_blocked: 'booking.notice.rangeBlocked',
  past: 'booking.notice.past',
};

function toDayPickerRange(range: IsoRange | undefined): DateRange | undefined {
  if (!range?.from) return undefined;
  return {
    from: parseIsoDateLocal(range.from),
    to: range.to ? parseIsoDateLocal(range.to) : undefined,
  };
}

function noticeText(
  notice: RangeNotice | null,
  range: IsoRange | undefined,
  calendar: { minNights: number; maxNights: number } | undefined,
  t: TFunction,
): string | null {
  if (notice) return t(NOTICE_KEYS[notice]);
  const problem = rangeProblem(range, calendar);
  if (problem === 'incomplete') {
    return range?.from ? t('booking.selectCheckOut') : t('booking.selectCheckIn');
  }
  if (problem === 'min_nights') return t('booking.minNightsHint', { count: calendar?.minNights });
  if (problem === 'max_nights') return t('booking.maxNightsHint', { count: calendar?.maxNights });
  return null;
}

function useBookingSelection(listing: PublicListing) {
  const { t } = useTranslation();
  const [range, setRange] = useState<IsoRange | undefined>();
  const [guests, setGuests] = useState(1);
  const [notice, setNotice] = useState<RangeNotice | null>(null);
  const calendarQuery = useListingCalendar(listing.id);
  const calendar = calendarQuery.data;
  const quote = useQuote({
    listingId: listing.id,
    checkIn: range?.from ?? null,
    checkOut: range?.to ?? null,
    guests,
    enabled: rangeIsQuoteable(range, calendar),
  });

  function handleSelect(date: Date): void {
    const result = selectRange(range, formatIsoDateLocal(date), {
      unavailable: unavailableSet(calendar),
      today: calendar?.today ?? formatIsoDateLocal(date),
    });
    setRange(result.range);
    setNotice(result.notice);
  }

  function reset(): void {
    setRange(undefined);
    setNotice(null);
  }

  return {
    calendarQuery,
    calendar,
    range,
    guests,
    setGuests,
    quote,
    handleSelect,
    reset,
    hint: noticeText(notice, range, calendar, t),
    nights: rangeNights(range),
  };
}

function SelectedDates({ range, language }: { range: IsoRange | undefined; language: string }) {
  const { t } = useTranslation();

  return (
    <dl className="grid grid-cols-2 gap-2">
      <div className="rounded-md border border-border px-3 py-2">
        <dt className="text-caption text-ink-muted">{t('booking.checkIn')}</dt>
        <dd className="text-small font-semibold text-ink">
          {range?.from ? formatLongDate(range.from, language) : '—'}
        </dd>
      </div>
      <div className="rounded-md border border-border px-3 py-2">
        <dt className="text-caption text-ink-muted">{t('booking.checkOut')}</dt>
        <dd className="text-small font-semibold text-ink">
          {range?.to ? formatLongDate(range.to, language) : '—'}
        </dd>
      </div>
    </dl>
  );
}

function CalendarLegend() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-ink-muted" aria-hidden="true" />
        {t('booking.legend.booked')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-ink-muted/60" aria-hidden="true" />
        {t('booking.legend.blocked')}
      </span>
    </div>
  );
}

function BookingError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-ink-muted">{t('booking.calendarError')}</p>
      <Button variant="secondary" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}

function BookingCta() {
  const { t } = useTranslation();

  return (
    <div>
      <Button fullWidth size="lg" disabled aria-describedby="booking-coming-soon">
        {t('booking.book')}
      </Button>
      <p id="booking-coming-soon" className="mt-2 text-center text-caption text-ink-muted">
        {t('booking.bookingSoon')}
      </p>
    </div>
  );
}

function BookingHeader({
  heading,
  minNights,
  hasRange,
  onReset,
}: {
  heading: boolean;
  minNights: number;
  hasRange: boolean;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        {heading ? <h2 className="text-h3 text-ink">{t('booking.title')}</h2> : null}
        <p className="mt-1 text-small text-ink-muted">
          {t('booking.minNightsHint', { count: minNights })}
        </p>
      </div>
      {hasRange ? (
        <Button variant="ghost" size="md" onClick={onReset}>
          {t('booking.clear')}
        </Button>
      ) : null}
    </div>
  );
}

export function BookingPanel({
  listing,
  heading = true,
}: {
  listing: PublicListing;
  heading?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const selection = useBookingSelection(listing);
  const { calendarQuery, calendar, range, guests, setGuests, quote, handleSelect, hint, nights } =
    selection;

  if (calendarQuery.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    );
  }

  if (calendarQuery.isError || !calendar) {
    return <BookingError onRetry={() => void calendarQuery.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <BookingHeader
        heading={heading}
        minNights={calendar.minNights}
        hasRange={Boolean(range?.from)}
        onReset={selection.reset}
      />

      <SelectedDates range={range} language={i18n.language} />
      <BookingCalendar
        calendar={calendar}
        selected={toDayPickerRange(range)}
        onSelect={handleSelect}
      />
      <CalendarLegend />

      <p role="status" aria-live="polite" className="min-h-5 text-small text-ink-muted">
        {hint ?? (nights > 0 ? t('booking.nights', { count: nights }) : '')}
      </p>

      <NumberStepper
        label={t('booking.guests')}
        value={guests}
        min={1}
        max={listing.maxGuests}
        onChange={setGuests}
        hint={t('booking.guestsHint', { count: listing.maxGuests })}
      />

      <QuoteSummary quote={quote.data} loading={quote.isFetching} error={quote.error} />
      <BookingCta />
    </div>
  );
}
