import type {
  BookingDetail,
  BookingResponse,
  BookingsResponse,
  BookingRole,
  CancelBookingInput,
  CreateBookingInput,
  DeclineBookingInput,
} from '@staynest/shared';
import { api } from '../../../shared/api';

export async function createBookingRequest(
  input: CreateBookingInput,
  idempotencyKey: string,
): Promise<BookingDetail> {
  const response = await api.post<BookingResponse>('/bookings', input, {
    headers: { 'idempotency-key': idempotencyKey },
  });
  return response.booking;
}

export async function fetchBookings(
  role: BookingRole,
  cursor: string | null,
): Promise<BookingsResponse> {
  const params = new URLSearchParams({ role, limit: '50' });
  if (cursor) params.set('cursor', cursor);
  return api.get<BookingsResponse>(`/me/bookings?${params.toString()}`);
}

export async function fetchBooking(id: string): Promise<BookingDetail> {
  const response = await api.get<BookingResponse>(`/bookings/${id}`);
  return response.booking;
}

export async function confirmBookingRequest(id: string): Promise<BookingDetail> {
  const response = await api.post<BookingResponse>(`/bookings/${id}/confirm`);
  return response.booking;
}

export async function declineBookingRequest(
  id: string,
  input: DeclineBookingInput,
): Promise<BookingDetail> {
  const response = await api.post<BookingResponse>(`/bookings/${id}/decline`, input);
  return response.booking;
}

export async function cancelBookingRequest(
  id: string,
  input: CancelBookingInput,
): Promise<BookingDetail> {
  const response = await api.post<BookingResponse>(`/bookings/${id}/cancel`, input);
  return response.booking;
}

/** Ключ должен быть стабильным для одинакового тела и меняться при правках формы. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
