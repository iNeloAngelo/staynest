import type { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { BookingDetail, BookingResponse, BookingStatus } from '@staynest/shared';
import { addDays } from '@staynest/shared';
import { futureDay, insertBookingRow, seedListing } from './support/booking-fixtures';
import {
  authHeaders,
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
} from './support/harness';
import type { Harness, TestUser } from './support/harness';

const url = databaseUrl ?? '';

async function action(
  h: Harness,
  user: TestUser,
  bookingId: string,
  request: { name: 'confirm' | 'decline' | 'cancel'; payload?: Record<string, unknown> },
) {
  return h.app.inject({
    method: 'POST',
    url: `/api/v1/bookings/${bookingId}/${request.name}`,
    headers: authHeaders(user.cookie),
    ...(request.payload === undefined ? {} : { payload: request.payload }),
  });
}

async function setupPending(h: Harness, host: TestUser, guest: TestUser) {
  const listingId = await seedListing(h, host.id);
  const id = await insertBookingRow(h, {
    listingId,
    guestId: guest.id,
    from: futureDay(20),
    to: futureDay(22),
  });
  return { listingId, id };
}

describeDatabase('статусы брони', () => {
  let client: Client;
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let stranger: TestUser;
  let otherHost: TestUser;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    host = await createUser(h, 'host@example.ru', 'Хозяин');
    guest = await createUser(h, 'guest@example.ru', 'Гость');
    stranger = await createUser(h, 'stranger@example.ru', 'Посторонний');
    otherHost = await createUser(h, 'other-host@example.ru', 'Второй хозяин');
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE listings RESTART IDENTITY CASCADE');
  });

  it('хозяин подтверждает заявку и пишет аудит', async () => {
    const { id } = await setupPending(h, host, guest);
    const response = await action(h, host, id, { name: 'confirm' });
    const { booking } = response.json() as BookingResponse;

    expect(response.statusCode).toBe(200);
    expect(booking.status).toBe('confirmed');
    expect(booking.confirmedAt).not.toBeNull();
    expect(booking.expiresAt).toBeNull();
    expect(booking.events.map((event) => event.toStatus)).toEqual(['pending', 'confirmed']);
    expect(booking.events.at(-1)).toMatchObject({ actorRole: 'host', note: null });
  });

  it('открывает адрес и телефон второй стороны только после подтверждения', async () => {
    const { id } = await setupPending(h, host, guest);
    await client.query('UPDATE users SET phone = $1 WHERE id = $2', ['+7 900 000-00-11', guest.id]);
    await client.query('UPDATE users SET phone = $1 WHERE id = $2', ['+7 900 000-00-22', host.id]);

    const pending = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${id}`,
      headers: authHeaders(guest.cookie),
    });
    expect((pending.json() as BookingResponse).booking.contacts).toBeNull();

    await action(h, host, id, { name: 'confirm' });

    const guestView = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${id}`,
      headers: authHeaders(guest.cookie),
    });
    const hostView = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${id}`,
      headers: authHeaders(host.cookie),
    });

    expect((guestView.json() as BookingResponse).booking.contacts).toEqual({
      addressLine: 'Лесная улица, 12',
      hostPhone: '+7 900 000-00-22',
      guestPhone: null,
    });
    expect((hostView.json() as BookingResponse).booking.contacts).toEqual({
      addressLine: 'Лесная улица, 12',
      hostPhone: null,
      guestPhone: '+7 900 000-00-11',
    });
  });

  it('гость не может подтвердить или отклонить заявку', async () => {
    const { id } = await setupPending(h, host, guest);

    const confirm = await action(h, guest, id, { name: 'confirm' });
    const decline = await action(h, guest, id, { name: 'decline', payload: { comment: 'Нет' } });

    expect(confirm.statusCode).toBe(403);
    expect(confirm.json()).toMatchObject({ code: 'booking_action_forbidden' });
    expect(decline.statusCode).toBe(403);
  });

  it('посторонний не видит и не меняет чужую бронь', async () => {
    const { id } = await setupPending(h, host, guest);

    const detail = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${id}`,
      headers: authHeaders(stranger.cookie),
    });
    const confirm = await action(h, stranger, id, { name: 'confirm' });
    const cancel = await action(h, stranger, id, { name: 'cancel' });

    expect(detail.statusCode).toBe(404);
    expect(confirm.statusCode).toBe(404);
    expect(cancel.statusCode).toBe(404);
  });

  it('публикует booking.* после коммита и только для успешного перехода', async () => {
    const confirmed: Array<{ bookingId: string; status: string }> = [];
    const declined: string[] = [];
    const cancelled: Array<{ bookingId: string; actorId: string }> = [];
    const unsubscribeConfirmed = h.events.subscribe('booking.confirmed', (payload) => {
      confirmed.push({ bookingId: payload.bookingId, status: payload.status });
    });
    const unsubscribeDeclined = h.events.subscribe('booking.declined', (payload) => {
      declined.push(payload.bookingId);
    });
    const unsubscribeCancelled = h.events.subscribe('booking.cancelled', (payload) => {
      cancelled.push({ bookingId: payload.bookingId, actorId: payload.actorId });
    });

    const first = await setupPending(h, host, guest);
    await action(h, host, first.id, { name: 'confirm' });
    const failed = await action(h, host, first.id, { name: 'confirm' });
    const second = await setupPending(h, host, guest);
    await action(h, host, second.id, { name: 'decline' });
    const listingId = await seedListing(h, host.id);
    const third = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(30),
      to: futureDay(32),
      status: 'confirmed',
    });
    await action(h, guest, third, { name: 'cancel' });

    unsubscribeConfirmed();
    unsubscribeDeclined();
    unsubscribeCancelled();

    expect(failed.statusCode).toBe(409);
    expect(confirmed).toEqual([{ bookingId: first.id, status: 'confirmed' }]);
    expect(declined).toEqual([second.id]);
    expect(cancelled).toEqual([{ bookingId: third, actorId: guest.id }]);
  });

  it('хозяин отклоняет заявку с комментарием', async () => {
    const { id } = await setupPending(h, host, guest);
    const response = await action(h, host, id, {
      name: 'decline',
      payload: { comment: 'Даты заняты' },
    });
    const { booking } = response.json() as BookingResponse;

    expect(response.statusCode).toBe(200);
    expect(booking.status).toBe('declined');
    expect(booking.hostResponse).toBe('Даты заняты');
    expect(booking.events.at(-1)).toMatchObject({
      actorRole: 'host',
      note: 'Даты заняты',
    });
  });

  it('гость отменяет pending без причины', async () => {
    const { id } = await setupPending(h, host, guest);
    const response = await action(h, guest, id, { name: 'cancel' });
    const { booking } = response.json() as BookingResponse;

    expect(response.statusCode).toBe(200);
    expect(booking.status).toBe('cancelled_by_guest');
    expect(booking.cancelledByRole).toBe('guest');
    expect(booking.events.at(-1)).toMatchObject({ actorRole: 'guest' });
  });

  it('хозяин отменяет confirmed только с причиной', async () => {
    const { id } = await setupPending(h, host, guest);
    await action(h, host, id, { name: 'confirm' });

    const withoutReason = await action(h, host, id, { name: 'cancel' });
    const withReason = await action(h, host, id, {
      name: 'cancel',
      payload: { reason: 'Авария' },
    });
    const { booking } = withReason.json() as BookingResponse;

    expect(withoutReason.statusCode).toBe(422);
    expect(withoutReason.json()).toMatchObject({ code: 'host_cancel_reason_required' });
    expect(withReason.statusCode).toBe(200);
    expect(booking.status).toBe('cancelled_by_host');
    expect(booking.cancelReason).toBe('Авария');
  });

  it('гость отменяет confirmed до заезда и не может после', async () => {
    const { id } = await setupPending(h, host, guest);
    await action(h, host, id, { name: 'confirm' });

    const response = await action(h, guest, id, { name: 'cancel' });
    expect(response.statusCode).toBe(200);
    expect((response.json() as BookingResponse).booking.status).toBe('cancelled_by_guest');

    const listingId = await seedListing(h, host.id);
    const started = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(0),
      to: futureDay(2),
      status: 'confirmed',
    });
    const late = await action(h, guest, started, { name: 'cancel' });

    expect(late.statusCode).toBe(422);
    expect(late.json()).toMatchObject({ code: 'cancellation_window_closed' });
  });

  it('возвращает 409 на запрещённые переходы', async () => {
    const cases: Array<{
      status: BookingStatus;
      name: 'confirm' | 'decline' | 'cancel';
      actor: 'host' | 'guest';
      payload?: Record<string, unknown>;
    }> = [
      { status: 'confirmed', name: 'confirm', actor: 'host' },
      { status: 'declined', name: 'decline', actor: 'host' },
      { status: 'expired', name: 'confirm', actor: 'host' },
      { status: 'completed', name: 'cancel', actor: 'guest' },
      { status: 'cancelled_by_guest', name: 'cancel', actor: 'guest' },
      { status: 'cancelled_by_host', name: 'cancel', actor: 'host', payload: { reason: 'X' } },
    ];

    for (const item of cases) {
      const listingId = await seedListing(h, host.id);
      const id = await insertBookingRow(h, {
        listingId,
        guestId: guest.id,
        from: futureDay(20),
        to: futureDay(22),
        status: item.status,
      });
      const response = await action(h, item.actor === 'host' ? host : guest, id, {
        name: item.name,
        ...(item.payload === undefined ? {} : { payload: item.payload }),
      });

      expect(response.statusCode, `${item.status} ${item.name}`).toBe(409);
      expect(response.json()).toMatchObject({ code: 'invalid_booking_transition' });
    }
  });

  it('гонка confirm и decline оставляет ровно одного победителя', async () => {
    const { id } = await setupPending(h, host, guest);

    const responses = await Promise.all([
      action(h, host, id, { name: 'confirm' }),
      action(h, host, id, { name: 'decline' }),
    ]);
    const statuses = responses.map((response) => response.statusCode).sort();

    expect(statuses).toEqual([200, 409]);
    const detail = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${id}`,
      headers: authHeaders(host.cookie),
    });

    expect(['confirmed', 'declined']).toContain(
      (detail.json() as { booking: BookingDetail }).booking.status,
    );
  });

  it('гонка confirm и cancel не теряет смену статуса', async () => {
    const { id } = await setupPending(h, host, guest);

    const [confirmResponse, cancelResponse] = await Promise.all([
      action(h, host, id, { name: 'confirm' }),
      action(h, guest, id, { name: 'cancel' }),
    ]);

    for (const response of [confirmResponse, cancelResponse]) {
      expect([200, 409]).toContain(response.statusCode);
    }

    const detail = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${id}`,
      headers: authHeaders(guest.cookie),
    });
    const { booking } = detail.json() as { booking: BookingDetail };
    const cancelEvents = booking.events.filter((event) => event.toStatus === 'cancelled_by_guest');
    const summary = [confirmResponse, cancelResponse]
      .map((response) => {
        const code = (response.json() as { code?: string }).code ?? 'ok';
        return `${response.statusCode}:${code}`;
      })
      .join(', ');
    const timeline = booking.events
      .map((event) => `${event.fromStatus ?? 'null'}->${event.toStatus}`)
      .join(', ');

    // Обе последовательности валидны: гость может отменить и pending, и
    // confirmed до заезда. Инвариант один: если cancel вернул 200, событие
    // отмены существует и финальный статус — cancelled_by_guest.
    if (cancelResponse.statusCode === 200) {
      expect(cancelEvents, `responses ${summary}; events ${timeline}`).toHaveLength(1);
      expect(booking.status, `responses ${summary}; events ${timeline}`).toBe('cancelled_by_guest');
    } else {
      expect(cancelEvents, `responses ${summary}; events ${timeline}`).toHaveLength(0);
      expect(booking.status, `responses ${summary}; events ${timeline}`).toBe('confirmed');
    }

    expect(booking.events.at(-1)?.toStatus, `responses ${summary}; events ${timeline}`).toBe(
      booking.status,
    );
  });

  it('отдаёт детали с таймлайном и список по ролям', async () => {
    const { id } = await setupPending(h, host, guest);
    await action(h, host, id, { name: 'confirm' });

    const detail = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${id}`,
      headers: authHeaders(guest.cookie),
    });
    const hostList = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/bookings?role=host&status=confirmed',
      headers: authHeaders(host.cookie),
    });
    const guestList = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/bookings?role=guest',
      headers: authHeaders(guest.cookie),
    });
    const strangerList = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/bookings',
      headers: authHeaders(stranger.cookie),
    });

    expect(detail.statusCode).toBe(200);
    expect((detail.json() as { booking: BookingDetail }).booking.events).toHaveLength(2);
    expect((hostList.json() as { bookings: unknown[] }).bookings).toHaveLength(1);
    expect((guestList.json() as { bookings: unknown[] }).bookings).toHaveLength(1);
    expect((strangerList.json() as { bookings: unknown[] }).bookings).toHaveLength(0);
  });

  it('role=host показывает только брони своих объявлений', async () => {
    const listingA = await seedListing(h, host.id);
    const bookingA = await insertBookingRow(h, {
      listingId: listingA,
      guestId: guest.id,
      from: futureDay(20),
      to: futureDay(22),
    });
    const listingB = await seedListing(h, otherHost.id);
    const bookingB = await insertBookingRow(h, {
      listingId: listingB,
      guestId: guest.id,
      from: futureDay(20),
      to: futureDay(22),
    });

    const listA = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/bookings?role=host',
      headers: authHeaders(host.cookie),
    });
    const listB = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/bookings?role=host',
      headers: authHeaders(otherHost.cookie),
    });
    const foreign = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${bookingA}`,
      headers: authHeaders(otherHost.cookie),
    });

    expect((listA.json() as { bookings: Array<{ id: string }> }).bookings.map((b) => b.id)).toEqual(
      [bookingA],
    );
    expect((listB.json() as { bookings: Array<{ id: string }> }).bookings.map((b) => b.id)).toEqual(
      [bookingB],
    );
    expect(foreign.statusCode).toBe(404);
  });

  it('пагинирует список курсором без дублей', async () => {
    const listingId = await seedListing(h, host.id);
    for (let index = 0; index < 3; index += 1) {
      await insertBookingRow(h, {
        listingId,
        guestId: guest.id,
        from: futureDay(20 + index * 3),
        to: addDays(futureDay(20 + index * 3), 2),
      });
    }

    const first = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/bookings?role=guest&limit=2',
      headers: authHeaders(guest.cookie),
    });
    const firstBody = first.json() as { bookings: BookingDetail[]; nextCursor: string | null };
    expect(firstBody.bookings).toHaveLength(2);
    expect(firstBody.nextCursor).not.toBeNull();

    const second = await h.app.inject({
      method: 'GET',
      url: `/api/v1/me/bookings?role=guest&limit=2&cursor=${firstBody.nextCursor}`,
      headers: authHeaders(guest.cookie),
    });
    const secondBody = second.json() as { bookings: BookingDetail[]; nextCursor: string | null };
    const ids = new Set([...firstBody.bookings, ...secondBody.bookings].map((item) => item.id));

    expect(secondBody.bookings).toHaveLength(1);
    expect(secondBody.nextCursor).toBeNull();
    expect(ids.size).toBe(3);
  });

  it('не теряет строки с одинаковым created_at', async () => {
    const listingId = await seedListing(h, host.id);
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const ids: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      ids.push(
        await insertBookingRow(h, {
          listingId,
          guestId: guest.id,
          from: futureDay(20 + index * 3),
          to: futureDay(22 + index * 3),
          createdAt,
        }),
      );
    }

    const first = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/bookings?role=guest&limit=2',
      headers: authHeaders(guest.cookie),
    });
    const firstBody = first.json() as { bookings: BookingDetail[]; nextCursor: string | null };
    const second = await h.app.inject({
      method: 'GET',
      url: `/api/v1/me/bookings?role=guest&limit=2&cursor=${firstBody.nextCursor}`,
      headers: authHeaders(guest.cookie),
    });
    const secondBody = second.json() as { bookings: BookingDetail[]; nextCursor: string | null };
    const fetched = [...firstBody.bookings, ...secondBody.bookings].map((item) => item.id);

    expect(new Set(fetched)).toEqual(new Set(ids));
    expect(fetched).toHaveLength(3);
  });

  it('отвергает испорченный курсор', async () => {
    const badShape = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/bookings?cursor=not-a-cursor',
      headers: authHeaders(guest.cookie),
    });
    const badTimestamp = Buffer.from(
      JSON.stringify({
        v: 1,
        createdAt: '2026-99-99T99:99:99Z',
        id: '00000000-0000-4000-8000-000000000000',
      }),
    ).toString('base64url');
    const badDate = await h.app.inject({
      method: 'GET',
      url: `/api/v1/me/bookings?cursor=${badTimestamp}`,
      headers: authHeaders(guest.cookie),
    });

    expect(badShape.statusCode).toBe(400);
    expect(badShape.json()).toMatchObject({ code: 'invalid_cursor' });
    expect(badDate.statusCode).toBe(400);
    expect(badDate.json()).toMatchObject({ code: 'invalid_cursor' });
  });

  it('не раскрывает бронь анониму', async () => {
    const { id } = await setupPending(h, host, guest);
    const response = await h.app.inject({ method: 'GET', url: `/api/v1/bookings/${id}` });
    expect(response.statusCode).toBe(401);
  });
});
