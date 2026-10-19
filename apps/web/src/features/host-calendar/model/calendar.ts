import type { HostCalendarResponse } from '@staynest/shared';
import { addDays, eachNight } from '@staynest/shared';
import type { DateRange } from 'react-day-picker';
import { parseIsoDateLocal } from '../../../shared/lib/dates';

export function busyNights(calendar: HostCalendarResponse | undefined): Set<string> {
  const nights = new Set<string>();
  if (!calendar) return nights;
  const last = addDays(calendar.to, -1);

  const addRange = (from: string, toExclusive: string): void => {
    for (const night of eachNight(from, toExclusive)) {
      if (night >= calendar.from && night <= last) nights.add(night);
    }
  };

  for (const booking of calendar.bookings) {
    addRange(booking.checkIn, booking.checkOut);
  }

  for (const block of calendar.blocks) {
    addRange(block.dateFrom, addDays(block.dateTo, 1));
  }

  return nights;
}

function bookingRange(from: string, to: string): DateRange {
  return { from: parseIsoDateLocal(from), to: parseIsoDateLocal(addDays(to, -1)) };
}

export function calendarModifiers(calendar: HostCalendarResponse | undefined): {
  pending: DateRange[];
  confirmed: DateRange[];
  blocked: DateRange[];
} {
  if (!calendar) return { pending: [], confirmed: [], blocked: [] };

  return {
    pending: calendar.bookings
      .filter((booking) => booking.status === 'pending')
      .map((booking) => bookingRange(booking.checkIn, booking.checkOut)),
    confirmed: calendar.bookings
      .filter((booking) => booking.status === 'confirmed')
      .map((booking) => bookingRange(booking.checkIn, booking.checkOut)),
    blocked: calendar.blocks.map((block) => ({
      from: parseIsoDateLocal(block.dateFrom),
      to: parseIsoDateLocal(block.dateTo),
    })),
  };
}

export function selectedDayPickerRange(
  range: { from: string; to?: string } | undefined,
): DateRange | undefined {
  if (!range?.from) return undefined;
  return {
    from: parseIsoDateLocal(range.from),
    to: range.to ? parseIsoDateLocal(range.to) : undefined,
  };
}
