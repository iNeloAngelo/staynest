import type { PublicListing } from '@staynest/shared';
import type { TFunction } from 'i18next';
import type { DateRange } from 'react-day-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../../shared/i18n';
import { formatIsoDateLocal, parseIsoDateLocal } from '../../../shared/lib/dates';
import { useListingCalendar, useQuote } from '../api/hooks';
import {
  rangeIsQuoteable,
  rangeNights,
  rangeProblem,
  selectRange,
  unavailableSet,
} from './selection';
import type { IsoRange, RangeNotice } from './selection';

const NOTICE_KEYS: Record<RangeNotice, TranslationKey> = {
  busy_start: 'booking.notice.busyStart',
  range_blocked: 'booking.notice.rangeBlocked',
  past: 'booking.notice.past',
};

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

export function toDayPickerRange(range: IsoRange | undefined): DateRange | undefined {
  if (!range?.from) return undefined;
  return {
    from: parseIsoDateLocal(range.from),
    to: range.to ? parseIsoDateLocal(range.to) : undefined,
  };
}

export function useBookingSelection(listing: PublicListing) {
  const { t } = useTranslation();
  const [range, setRange] = useState<IsoRange | undefined>();
  const [guests, setGuests] = useState(1);
  const [message, setMessage] = useState('');
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
    message,
    setMessage,
    quote,
    handleSelect,
    reset,
    hint: noticeText(notice, range, calendar, t),
    nights: rangeNights(range),
  };
}
