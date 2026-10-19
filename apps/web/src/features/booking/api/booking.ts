import type { CalendarResponse, Quote, QuoteResponse } from '@staynest/shared';
import { addDays } from '@staynest/shared';
import { api } from '../../../shared/api';
import { todayLocalIso } from '../../../shared/lib/dates';

const CALENDAR_DAYS_AHEAD = 366;

function calendarWindow(): { from: string; to: string } {
  const today = todayLocalIso();
  // Один день назад — запас на разницу часовых поясов; API вернёт точное `today`.
  return { from: addDays(today, -1), to: addDays(today, CALENDAR_DAYS_AHEAD) };
}

export async function fetchListingCalendar(id: string): Promise<CalendarResponse> {
  const { from, to } = calendarWindow();
  const params = new URLSearchParams({ from, to });
  return api.get<CalendarResponse>(`/listings/${id}/calendar?${params.toString()}`);
}

export async function fetchQuote(
  id: string,
  checkIn: string,
  checkOut: string,
  guests: number,
): Promise<Quote> {
  const params = new URLSearchParams({ checkIn, checkOut, guests: String(guests) });
  const response = await api.get<QuoteResponse>(`/listings/${id}/quote?${params.toString()}`);
  return response.quote;
}
