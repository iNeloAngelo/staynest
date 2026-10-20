import type {
  BookingDetail,
  BookingRole,
  CancelBookingInput,
  CreateBookingInput,
  DeclineBookingInput,
} from '@staynest/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { markInstallEligible } from '../../pwa';
import {
  cancelBookingRequest,
  confirmBookingRequest,
  createBookingRequest,
  declineBookingRequest,
  fetchBooking,
  fetchBookings,
} from './bookings';

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (role: BookingRole) => ['bookings', 'list', role] as const,
  detail: (id: string) => ['bookings', 'detail', id] as const,
  calendar: (id: string) => ['booking', 'calendar', id] as const,
  quote: (id: string, checkIn: string, checkOut: string, guests: number) =>
    ['booking', 'quote', id, checkIn, checkOut, guests] as const,
};

function useBookingInvalidation() {
  const queryClient = useQueryClient();

  return (booking: BookingDetail) => {
    queryClient.setQueryData(bookingKeys.detail(booking.id), booking);
    void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['host-calendar'] });
    void queryClient.invalidateQueries({ queryKey: ['booking'] });
  };
}

export function useBookings(role: BookingRole) {
  return useInfiniteQuery({
    queryKey: bookingKeys.list(role),
    queryFn: ({ pageParam }) => fetchBookings(role, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useBooking(id: string | undefined) {
  return useQuery<BookingDetail>({
    queryKey: bookingKeys.detail(id ?? ''),
    queryFn: () => fetchBooking(id ?? ''),
    enabled: Boolean(id),
  });
}

export function useCreateBooking() {
  const invalidate = useBookingInvalidation();

  return useMutation({
    mutationFn: ({ input, key }: { input: CreateBookingInput; key: string }) =>
      createBookingRequest(input, key),
    onSuccess: (booking) => {
      invalidate(booking);
      // После успешной заявки установка PWA уместнее, чем на первом визите.
      markInstallEligible();
    },
  });
}

export function useConfirmBooking() {
  const invalidate = useBookingInvalidation();

  return useMutation({
    mutationFn: (id: string) => confirmBookingRequest(id),
    onSuccess: (booking) => {
      invalidate(booking);
    },
  });
}

export function useDeclineBooking() {
  const invalidate = useBookingInvalidation();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DeclineBookingInput }) =>
      declineBookingRequest(id, input),
    onSuccess: (booking) => {
      invalidate(booking);
    },
  });
}

export function useCancelBooking() {
  const invalidate = useBookingInvalidation();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CancelBookingInput }) =>
      cancelBookingRequest(id, input),
    onSuccess: (booking) => {
      invalidate(booking);
    },
  });
}
