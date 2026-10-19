import { describe, expect, it } from 'vitest';
import type { HostCalendarResponse } from '@staynest/shared';
import { busyNights } from './calendar';

function calendar(overrides: Partial<HostCalendarResponse> = {}): HostCalendarResponse {
  return {
    listingId: '11111111-1111-4111-8111-111111111111',
    from: '2026-10-01',
    to: '2026-10-31',
    today: '2026-10-01',
    bookings: [],
    blocks: [],
    ...overrides,
  };
}

describe('busyNights', () => {
  it('не занимает ночь выезда брони', () => {
    const nights = busyNights(
      calendar({
        bookings: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            status: 'confirmed',
            checkIn: '2026-10-10',
            checkOut: '2026-10-12',
            guestName: 'Гость',
          },
        ],
      }),
    );

    expect([...nights]).toEqual(['2026-10-10', '2026-10-11']);
  });

  it('считает блокировку включительно', () => {
    const nights = busyNights(
      calendar({
        blocks: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            listingId: '11111111-1111-4111-8111-111111111111',
            dateFrom: '2026-10-15',
            dateTo: '2026-10-16',
            reason: 'Ремонт',
            createdAt: '2026-10-01T10:00:00.000Z',
          },
        ],
      }),
    );

    expect([...nights]).toEqual(['2026-10-15', '2026-10-16']);
  });

  it('обрезает диапазон по окну календаря', () => {
    const nights = busyNights(
      calendar({
        from: '2026-10-10',
        to: '2026-10-13',
        blocks: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            listingId: '11111111-1111-4111-8111-111111111111',
            dateFrom: '2020-01-01',
            dateTo: '2030-01-01',
            reason: null,
            createdAt: '2026-10-01T10:00:00.000Z',
          },
        ],
      }),
    );

    expect([...nights]).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
  });
});
