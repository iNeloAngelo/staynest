import { describe, expect, it } from 'vitest';
import { mapBookingInsertError } from './errors';

describe('ошибки движка бронирования', () => {
  it('превращает нарушение exclusion constraint в 409', () => {
    const error = mapBookingInsertError({ code: '23P01' });

    expect(error?.status).toBe(409);
    expect(error?.code).toBe('booking_dates_unavailable');
  });

  it('не подменяет другие ошибки БД', () => {
    expect(mapBookingInsertError({ code: '23505' })).toBeNull();
    expect(mapBookingInsertError(new Error('boom'))).toBeNull();
  });
});
