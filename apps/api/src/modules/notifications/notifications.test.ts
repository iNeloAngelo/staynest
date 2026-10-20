import { describe, expect, it, vi } from 'vitest';
import type { NotificationDto } from '@staynest/shared';
import { decodeNotificationCursor, encodeNotificationCursor } from './cursor';
import { createNotificationHub } from './hub';
import { pushMessage } from './texts';

const payload: NotificationDto['payload'] = {
  bookingId: '0b6f6f46-6a9d-4f6b-8f4a-4f67f5a1b222',
  listingId: 'b2f7e8d1-4f1a-4c6e-9a0b-1c2d3e4f5a6b',
  listingTitle: 'Дом у озера',
  checkIn: '2026-11-10',
  checkOut: '2026-11-12',
  guestName: 'Анна',
  totalMinor: 250_000,
  currency: 'RUB',
};

const notification: NotificationDto = {
  id: 'a11f5f4b-0f77-4c4e-9f0a-6b1c2d3e4f55',
  type: 'booking_requested',
  payload,
  readAt: null,
  createdAt: '2026-10-20T10:00:00.000Z',
};

describe('курсор уведомлений', () => {
  it('кодирует и разбирает точное время', () => {
    const cursor = { v: 1 as const, createdAt: '2026-10-20T10:00:00.123456Z', id: notification.id };
    expect(decodeNotificationCursor(encodeNotificationCursor(cursor))).toEqual(cursor);
  });

  it('отвергает несуществующую дату и мусор', () => {
    const invalid = Buffer.from(
      JSON.stringify({ v: 1, createdAt: '2026-99-99T99:99:99Z', id: notification.id }),
    ).toString('base64url');

    expect(() => decodeNotificationCursor(invalid)).toThrow(/Курсор/);
    expect(() => decodeNotificationCursor('not-a-cursor')).toThrow(/Курсор/);
  });
});

describe('hub SSE', () => {
  it('ограничивает число потоков и доставляет уведомление', () => {
    const hub = createNotificationHub(1);
    const first = { send: vi.fn(), close: vi.fn() };
    const second = { send: vi.fn(), close: vi.fn() };

    expect(hub.subscribe('user-1', first)).toBe(true);
    expect(hub.subscribe('user-1', second)).toBe(false);

    hub.publish('user-1', notification);
    expect(first.send).toHaveBeenCalledWith(notification);
    expect(second.send).not.toHaveBeenCalled();

    hub.unsubscribe('user-1', first);
    expect(hub.count('user-1')).toBe(0);
    expect(hub.subscribe('user-1', second)).toBe(true);

    hub.closeAll();
    expect(second.close).toHaveBeenCalled();
    expect(hub.count('user-1')).toBe(0);
  });
});

describe('тексты push', () => {
  it('переводит заявку и подтверждение на ru и en', () => {
    const ru = pushMessage('booking_requested', payload, 'ru', 'Europe/Moscow');
    expect(ru.title).toBe('Новая заявка');
    expect(ru.body).toContain('Анна');
    expect(ru.body).toContain('Дом у озера');
    expect(ru.url).toBe(`/bookings/${payload.bookingId}`);

    const en = pushMessage('booking_confirmed', payload, 'en', 'Europe/Moscow');
    expect(en.title).toBe('Booking confirmed');
    expect(en.body).toContain('November');
  });

  it('учитывает сторону отмены и срок напоминания', () => {
    const hostCancelled = pushMessage(
      'booking_cancelled',
      { ...payload, actorRole: 'host' },
      'ru',
      'Europe/Moscow',
    );
    expect(hostCancelled.title).toBe('Бронирование отменено');

    const guestCancelled = pushMessage(
      'booking_cancelled',
      { ...payload, actorRole: 'guest' },
      'ru',
      'Europe/Moscow',
    );
    expect(guestCancelled.title).toBe('Гость отменил заявку');

    const expiring = pushMessage(
      'booking_expiring_soon',
      { ...payload, expiresAt: '2026-10-20T12:00:00.000Z' },
      'en',
      'Europe/Moscow',
    );
    expect(expiring.title).toBe('Request expires soon');
    expect(expiring.body).toContain('before');
  });
});
