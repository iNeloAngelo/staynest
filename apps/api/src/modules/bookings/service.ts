import type {
  BookingDetail,
  BookingListQuery,
  BookingResponse,
  BookingsResponse,
  CancelBookingInput,
  CreateBookingInput,
  DeclineBookingInput,
} from '@staynest/shared';
import { createBooking } from './create';
import type { CreateBookingResult } from './create';
import { createBookingRuntime } from './context';
import type { BookingServiceDependencies } from './context';
import { getBooking, listBookings } from './read';
import { applyBookingAction } from './transition';

export function createBookingService(dependencies: BookingServiceDependencies) {
  const runtime = createBookingRuntime(dependencies);

  return {
    create(
      guestId: string,
      input: CreateBookingInput,
      idempotencyKey: string,
    ): Promise<CreateBookingResult> {
      return createBooking(runtime, guestId, input, idempotencyKey);
    },

    list(userId: string, query: BookingListQuery): Promise<BookingsResponse> {
      return listBookings(runtime, userId, query);
    },

    get(userId: string, bookingId: string): Promise<BookingDetail> {
      return getBooking(runtime, userId, bookingId);
    },

    confirm(actorId: string, bookingId: string): Promise<BookingResponse> {
      return applyBookingAction(runtime, { actorId, bookingId, action: 'confirm' });
    },

    decline(
      actorId: string,
      bookingId: string,
      input: DeclineBookingInput,
    ): Promise<BookingResponse> {
      return applyBookingAction(runtime, { actorId, bookingId, action: 'decline', input });
    },

    cancel(
      actorId: string,
      bookingId: string,
      input: CancelBookingInput,
    ): Promise<BookingResponse> {
      return applyBookingAction(runtime, { actorId, bookingId, action: 'cancel', input });
    },
  };
}

export type BookingService = ReturnType<typeof createBookingService>;
