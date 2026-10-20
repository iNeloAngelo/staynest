import type { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { BookingResponse, DepositPaymentResponse } from '@staynest/shared';
import { createPaymentJobs } from '../src/modules/bookings/index';
import { signMockWebhook } from '../src/modules/bookings/payments/provider';
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
  name: 'confirm' | 'cancel',
): Promise<BookingResponse> {
  const response = await h.app.inject({
    method: 'POST',
    url: `/api/v1/bookings/${bookingId}/${name}`,
    headers: authHeaders(user.cookie),
    ...(name === 'cancel' ? { payload: {} } : {}),
  });
  expect(response.statusCode).toBe(200);
  return response.json() as BookingResponse;
}

async function confirmedBooking(h: Harness, host: TestUser, guest: TestUser) {
  const listingId = await seedListing(h, host.id);
  const id = await insertBookingRow(h, {
    listingId,
    guestId: guest.id,
    from: futureDay(20),
    to: futureDay(22),
  });
  const { booking } = await action(h, host, id, 'confirm');
  return { id, booking };
}

function startDeposit(h: Harness, guest: TestUser, bookingId: string) {
  return h.app.inject({
    method: 'POST',
    url: `/api/v1/bookings/${bookingId}/deposit`,
    headers: authHeaders(guest.cookie),
  });
}

function sessionToken(payUrl: string): string {
  return payUrl.split('/').at(-1) ?? '';
}

function webhook(
  h: Harness,
  event: {
    externalId: string;
    status: 'succeeded' | 'failed';
    amountMinor: number;
    currency: string;
    occurredAt?: string;
    card?: string;
  },
  signature?: string,
) {
  const raw = JSON.stringify({ occurredAt: new Date().toISOString(), ...event });
  return h.app.inject({
    method: 'POST',
    url: '/api/v1/payments/webhook/mock',
    headers: {
      'content-type': 'application/json',
      'x-mock-signature': signature ?? signMockWebhook(h.config.payments.webhookSecret, raw),
    },
    payload: raw,
  });
}

describeDatabase('депозит и вебхуки', () => {
  let client: Client;
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    host = await createUser(h, 'host@example.ru', 'Хозяин');
    guest = await createUser(h, 'guest@example.ru', 'Гость');
    stranger = await createUser(h, 'stranger@example.ru', 'Посторонний');
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE listings RESTART IDENTITY CASCADE');
  });

  it('подтверждение создаёт депозит 20% со сроком оплаты', async () => {
    const { booking } = await confirmedBooking(h, host, guest);

    expect(booking.deposit).toMatchObject({
      status: 'created',
      amountMinor: 20_000,
      currency: 'RUB',
      paidAt: null,
      refundedAt: null,
    });
    expect(booking.deposit?.dueAt).toBeTruthy();
  });

  it('гость открывает сессию, повторный запрос возвращает ту же ссылку', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const first = await startDeposit(h, guest, id);
    const second = await startDeposit(h, guest, id);

    expect(first.statusCode).toBe(200);
    const body = first.json() as DepositPaymentResponse;
    expect(body.payUrl).toContain('/api/v1/mock-payments/');
    expect((second.json() as DepositPaymentResponse).payment.id).toBe(body.payment.id);
    expect((second.json() as DepositPaymentResponse).payUrl).toBe(body.payUrl);
  });

  it('хозяин и посторонний не могут открыть оплату', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const hostAttempt = await startDeposit(h, host, id);
    const strangerAttempt = await startDeposit(h, stranger, id);

    expect(hostAttempt.statusCode).toBe(403);
    expect(hostAttempt.json()).toMatchObject({ code: 'payment_forbidden' });
    expect(strangerAttempt.statusCode).toBe(404);
  });

  it('депозит недоступен для pending и после оплаты, срок проверяется', async () => {
    const listingId = await seedListing(h, host.id);
    const pendingId = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(30),
      to: futureDay(32),
    });
    const pending = await startDeposit(h, guest, pendingId);
    expect(pending.statusCode).toBe(409);
    expect(pending.json()).toMatchObject({ code: 'deposit_unavailable' });

    const { id } = await confirmedBooking(h, host, guest);
    const session = (await startDeposit(h, guest, id)).json() as DepositPaymentResponse;
    await webhook(h, {
      externalId: sessionToken(session.payUrl),
      status: 'succeeded',
      amountMinor: session.payment.amountMinor,
      currency: session.payment.currency,
    });

    const paid = await startDeposit(h, guest, id);
    expect(paid.statusCode).toBe(409);
    expect(paid.json()).toMatchObject({ code: 'deposit_already_paid' });

    const second = await confirmedBooking(h, host, guest);
    await client.query(
      "UPDATE bookings SET deposit_due_at = now() - interval '1 hour' WHERE id = $1",
      [second.id],
    );
    const expired = await startDeposit(h, guest, second.id);
    expect(expired.statusCode).toBe(409);
    expect(expired.json()).toMatchObject({ code: 'deposit_expired' });
  });

  it('неизвестный external_id не раскрывает платежи', async () => {
    const response = await webhook(h, {
      externalId: 'unknown-session-token-123456',
      status: 'succeeded',
      amountMinor: 1,
      currency: 'RUB',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'payment_not_found' });
  });

  it('валидный вебхук проводит платёж, повтор идемпотентен', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const session = (await startDeposit(h, guest, id)).json() as DepositPaymentResponse;
    const event = {
      externalId: sessionToken(session.payUrl),
      status: 'succeeded' as const,
      amountMinor: session.payment.amountMinor,
      currency: session.payment.currency,
    };

    const first = await webhook(h, event);
    const second = await webhook(h, event);

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ received: true, replayed: false });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ received: true, replayed: true });

    const mismatched = await webhook(h, { ...event, amountMinor: event.amountMinor + 1 });
    expect(mismatched.statusCode).toBe(409);
    expect(mismatched.json()).toMatchObject({ code: 'payment_webhook_conflict' });

    const detail = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${id}`,
      headers: authHeaders(guest.cookie),
    });
    expect((detail.json() as BookingResponse).booking.deposit).toMatchObject({
      status: 'succeeded',
      paidAt: expect.any(String),
    });

    const rows = await client.query(
      "SELECT count(*)::int AS count FROM payments WHERE booking_id = $1 AND status = 'succeeded'",
      [id],
    );
    expect(rows.rows[0].count).toBe(1);
  });

  it('неверная подпись и конфликт события не меняют платёж', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const session = (await startDeposit(h, guest, id)).json() as DepositPaymentResponse;
    const event = {
      externalId: sessionToken(session.payUrl),
      status: 'succeeded' as const,
      amountMinor: session.payment.amountMinor,
      currency: session.payment.currency,
    };

    const forged = await webhook(h, event, 'a'.repeat(64));
    const wrongAmount = await webhook(h, { ...event, amountMinor: event.amountMinor - 1 });

    expect(forged.statusCode).toBe(401);
    expect(forged.json()).toMatchObject({ code: 'payment_signature_invalid' });
    expect(wrongAmount.statusCode).toBe(409);
    expect(wrongAmount.json()).toMatchObject({ code: 'payment_webhook_conflict' });

    const rows = await client.query('SELECT status FROM payments WHERE booking_id = $1', [id]);
    expect(rows.rows).toEqual([{ status: 'created' }]);
  });

  it('карточные поля в вебхуке отвергаются и не попадают в БД', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const session = (await startDeposit(h, guest, id)).json() as DepositPaymentResponse;
    const response = await webhook(h, {
      externalId: sessionToken(session.payUrl),
      status: 'succeeded',
      amountMinor: session.payment.amountMinor,
      currency: session.payment.currency,
      card: '4111 1111 1111 1111',
    });

    expect(response.statusCode).toBe(400);
    const rows = await client.query('SELECT raw_event FROM payments WHERE booking_id = $1', [id]);
    expect(rows.rows[0].raw_event).toBeNull();
  });

  it('просроченный депозит отменяет бронь, закрывает платёж и освобождает даты', async () => {
    const { id, booking } = await confirmedBooking(h, host, guest);
    await startDeposit(h, guest, id);
    await client.query(
      "UPDATE bookings SET deposit_due_at = now() - interval '1 hour' WHERE id = $1",
      [id],
    );

    const jobs = createPaymentJobs({
      db: h.db,
      config: h.config,
      events: h.events,
      logger: h.logger,
    });
    const count = await jobs.expireDeposits();
    expect(count).toBe(1);

    const bookingRow = await client.query('SELECT status FROM bookings WHERE id = $1', [id]);
    const payment = await client.query('SELECT status FROM payments WHERE booking_id = $1', [id]);
    expect(bookingRow.rows[0].status).toBe('expired');
    expect(payment.rows[0].status).toBe('failed');

    const freeId = await insertBookingRow(h, {
      listingId: booking.listingId,
      guestId: guest.id,
      from: booking.checkIn,
      to: booking.checkOut,
    });
    expect(freeId).toBeTruthy();
  });

  it('поздний успешный вебхук после срока записывается возвратом', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const session = (await startDeposit(h, guest, id)).json() as DepositPaymentResponse;
    await client.query(
      "UPDATE bookings SET deposit_due_at = now() - interval '1 hour' WHERE id = $1",
      [id],
    );

    const late = await webhook(h, {
      externalId: sessionToken(session.payUrl),
      status: 'succeeded',
      amountMinor: session.payment.amountMinor,
      currency: session.payment.currency,
    });

    expect(late.statusCode).toBe(200);
    const payment = await client.query('SELECT status FROM payments WHERE booking_id = $1', [id]);
    expect(payment.rows[0].status).toBe('refunded');
  });

  it('отмена без оплаты закрывает депозит и не приглашает платить', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    await startDeposit(h, guest, id);
    await action(h, guest, id, 'cancel');

    const detail = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${id}`,
      headers: authHeaders(guest.cookie),
    });
    expect((detail.json() as BookingResponse).booking.deposit?.status).toBe('failed');

    const payment = await client.query('SELECT status FROM payments WHERE booking_id = $1', [id]);
    expect(payment.rows[0].status).toBe('failed');
  });

  it('оплата успела первой, затем отмена возвращает депозит', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const session = (await startDeposit(h, guest, id)).json() as DepositPaymentResponse;
    await webhook(h, {
      externalId: sessionToken(session.payUrl),
      status: 'succeeded',
      amountMinor: session.payment.amountMinor,
      currency: session.payment.currency,
    });
    await action(h, guest, id, 'cancel');

    const booking = await client.query('SELECT status FROM bookings WHERE id = $1', [id]);
    const payment = await client.query('SELECT status FROM payments WHERE booking_id = $1', [id]);
    expect(booking.rows[0].status).toBe('cancelled_by_guest');
    expect(payment.rows[0].status).toBe('refunded');
  });

  it('отмена успела первой, поздний успешный вебхук возвращает депозит', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const session = (await startDeposit(h, guest, id)).json() as DepositPaymentResponse;
    await action(h, guest, id, 'cancel');
    const late = await webhook(h, {
      externalId: sessionToken(session.payUrl),
      status: 'succeeded',
      amountMinor: session.payment.amountMinor,
      currency: session.payment.currency,
    });

    expect(late.statusCode).toBe(200);
    const booking = await client.query('SELECT status FROM bookings WHERE id = $1', [id]);
    const payment = await client.query('SELECT status FROM payments WHERE booking_id = $1', [id]);
    expect(booking.rows[0].status).toBe('cancelled_by_guest');
    expect(payment.rows[0].status).toBe('refunded');
  });

  it('гонка оплаты и отмены заканчивается возвратом, а не оплатой отменённой брони', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const session = (await startDeposit(h, guest, id)).json() as DepositPaymentResponse;
    const event = {
      externalId: sessionToken(session.payUrl),
      status: 'succeeded' as const,
      amountMinor: session.payment.amountMinor,
      currency: session.payment.currency,
    };

    await Promise.all([action(h, guest, id, 'cancel'), webhook(h, event)]);

    const booking = await client.query('SELECT status FROM bookings WHERE id = $1', [id]);
    const payment = await client.query('SELECT status FROM payments WHERE booking_id = $1', [id]);
    expect(booking.rows[0].status).toBe('cancelled_by_guest');
    expect(payment.rows[0].status).toBe('refunded');
  });

  it('страница мок-провайдера показывает сумму и не содержит полей карты', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const session = (await startDeposit(h, guest, id)).json() as DepositPaymentResponse;
    const page = await h.app.inject({ method: 'GET', url: session.payUrl });

    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toMatch(/200[\s\u00a0]₽/);
    expect(page.body).not.toContain('<input');
    expect(page.body).not.toMatch(/cardnumber|cvv|credit card/i);
  });

  it('оплата через страницу провайдера возвращает на бронь', async () => {
    const { id } = await confirmedBooking(h, host, guest);
    const session = (await startDeposit(h, guest, id)).json() as DepositPaymentResponse;
    const completed = await h.app.inject({
      method: 'POST',
      url: session.payUrl,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'result=pay',
    });

    expect(completed.statusCode).toBe(303);
    expect(completed.headers.location).toBe(`http://localhost:5173/bookings/${id}?payment=success`);

    const detail = await h.app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${id}`,
      headers: authHeaders(guest.cookie),
    });
    expect((detail.json() as BookingResponse).booking.deposit?.status).toBe('succeeded');
  });

  it('при выключенном моке публичные платёжные маршруты не регистрируются', async () => {
    const disabled = await createHarness({
      payments: { ...h.config.payments, mockEnabled: false },
    });
    try {
      const webhookResponse = await disabled.app.inject({
        method: 'POST',
        url: '/api/v1/payments/webhook/mock',
        headers: { 'content-type': 'application/json' },
        payload: '{}',
      });
      const page = await disabled.app.inject({
        method: 'GET',
        url: '/api/v1/mock-payments/unknown-token-123456',
      });

      expect(webhookResponse.statusCode).toBe(404);
      expect(page.statusCode).toBe(404);
    } finally {
      await disabled.app.close();
      await disabled.db.close();
    }
  });
});
