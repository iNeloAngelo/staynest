import type { CalendarResponse, Quote } from '@staynest/shared';
import { useQuery } from '@tanstack/react-query';
import { fetchListingCalendar, fetchQuote } from './booking';
import { bookingKeys } from './bookings-hooks';

const CALENDAR_STALE_TIME_MS = 30_000;

export function useListingCalendar(id: string) {
  return useQuery<CalendarResponse>({
    queryKey: bookingKeys.calendar(id),
    queryFn: () => fetchListingCalendar(id),
    enabled: Boolean(id),
    staleTime: CALENDAR_STALE_TIME_MS,
  });
}

export function useQuote(input: {
  listingId: string;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  enabled: boolean;
}) {
  return useQuery<Quote>({
    queryKey: bookingKeys.quote(
      input.listingId,
      input.checkIn ?? '',
      input.checkOut ?? '',
      input.guests,
    ),
    queryFn: () =>
      fetchQuote(input.listingId, input.checkIn ?? '', input.checkOut ?? '', input.guests),
    enabled: input.enabled && Boolean(input.checkIn) && Boolean(input.checkOut),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
