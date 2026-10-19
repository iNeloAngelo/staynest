import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { addDays } from '@staynest/shared';
import { createBookingJobs } from '../src/modules/bookings/index';
import { BOOKING_ENDPOINT } from '../src/modules/bookings/idempotency';
import {
  createBookingRequest,
  futureDay,
  insertBookingRow,
  seedListing,
} from './support/booking-fixtures';
import {
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
} from './support/harness';
import type { Harness, TestUser } from './support/harness';

const url = databaseUrl ?? '';

describeDatabase('фоновые задачи бронирования', () => {
  let client: Client;
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    host = await createUser(h, 'host@example.ru', 'Хозяин');
    guest = await createUser(h, 'guest@example.ru', 'Гость');
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE listings RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE idempotency_keys');
  });

  function jobs() {
    return createBookingJobs({
      db: h.db,
      config: h.config,
      events: h.events,
      logger: h.logger,
    });
  }

  async function bookingStatus(id: string): Promise<string> {
    const row = await h.db.kysely
      .selectFrom('bookings')
      .select('status')
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    return row.status;
  }

  it('истекает только pending с прошедшим expires_at и публикует событие', async () => {
    const listingId = await seedListing(h, host.id);
    const expiredId = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(20),
      to: futureDay(22),
      expiresAt: new Date(Date.now() - 60_000),
    });
    const liveId = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(25),
      to: futureDay(27),
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const published: string[] = [];
    const unsubscribe = h.events.subscribe('booking.expired', (payload) => {
      published.push(payload.bookingId);
    });

    const count = await jobs().expirePending();
    unsubscribe();

    expect(count).toBe(1);
    expect(await bookingStatus(expiredId)).toBe('expired');
    expect(await bookingStatus(liveId)).toBe('pending');
    expect(published).toEqual([expiredId]);

    const event = await h.db.kysely
      .selectFrom('booking_events')
      .select(['actor_id', 'from_status', 'to_status', 'note'])
      .where('booking_id', '=', expiredId)
      .where('to_status', '=', 'expired')
      .executeTakeFirstOrThrow();
    expect(event).toEqual({
      actor_id: null,
      from_status: 'pending',
      to_status: 'expired',
      note: 'expires_at',
    });
  });

  it('освобождает даты после истечения заявки', async () => {
    const listingId = await seedListing(h, host.id);
    const checkIn = futureDay(20);
    await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: checkIn,
      to: addDays(checkIn, 2),
      expiresAt: new Date(Date.now() - 60_000),
    });

    await jobs().expirePending();

    const quote = await h.app.inject({
      method: 'GET',
      url: `/api/v1/listings/${listingId}/quote?checkIn=${checkIn}&checkOut=${addDays(checkIn, 2)}&guests=2`,
    });
    const booking = await createBookingRequest(h, guest, listingId, {
      key: randomUUID(),
      checkIn,
      checkOut: addDays(checkIn, 2),
    });

    expect(quote.statusCode).toBe(200);
    expect(booking.statusCode).toBe(201);
  });

  it('завершает только confirmed с прошедшей датой выезда', async () => {
    const listingId = await seedListing(h, host.id);
    const pastId = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(-5),
      to: futureDay(-2),
      status: 'confirmed',
    });
    const currentId = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(-2),
      to: futureDay(1),
      status: 'confirmed',
    });
    const boundaryId = await insertBookingRow(h, {
      listingId: await seedListing(h, host.id),
      guestId: guest.id,
      from: futureDay(-2),
      to: futureDay(0),
      status: 'confirmed',
    });
    const pendingId = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(10),
      to: futureDay(12),
      status: 'pending',
    });

    const published: string[] = [];
    const unsubscribe = h.events.subscribe('booking.completed', (payload) => {
      published.push(payload.bookingId);
    });
    const count = await jobs().completePast();
    unsubscribe();

    expect(count).toBe(1);
    expect(await bookingStatus(pastId)).toBe('completed');
    expect(await bookingStatus(currentId)).toBe('confirmed');
    expect(await bookingStatus(boundaryId)).toBe('confirmed');
    expect(await bookingStatus(pendingId)).toBe('pending');
    expect(published).toEqual([pastId]);

    const event = await h.db.kysely
      .selectFrom('booking_events')
      .select(['actor_id', 'from_status', 'to_status', 'note'])
      .where('booking_id', '=', pastId)
      .where('to_status', '=', 'completed')
      .executeTakeFirstOrThrow();
    expect(event).toEqual({
      actor_id: null,
      from_status: 'confirmed',
      to_status: 'completed',
      note: 'check_out',
    });
  });

  it('истекает pending до confirm, даже если джоб ещё не отработал', async () => {
    const listingId = await seedListing(h, host.id);
    const id = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(20),
      to: futureDay(22),
      expiresAt: new Date(Date.now() - 60_000),
    });

    const confirmResponse = await h.app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${id}/confirm`,
      headers: { cookie: host.cookie },
    });
    const status = await bookingStatus(id);
    const expired = await jobs().expirePending();

    expect(confirmResponse.statusCode).toBe(409);
    expect(confirmResponse.json()).toMatchObject({ code: 'invalid_booking_transition' });
    expect(status).toBe('expired');
    expect(expired).toBe(0);

    const event = await h.db.kysely
      .selectFrom('booking_events')
      .select(['actor_id', 'from_status', 'to_status', 'note'])
      .where('booking_id', '=', id)
      .where('to_status', '=', 'expired')
      .executeTakeFirstOrThrow();
    expect(event).toEqual({
      actor_id: null,
      from_status: 'pending',
      to_status: 'expired',
      note: 'expires_at',
    });
  });

  it('не даёт подтвердить истёкшую заявку параллельно с джобом', async () => {
    const listingId = await seedListing(h, host.id);
    const id = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(24),
      to: futureDay(26),
      expiresAt: new Date(Date.now() - 60_000),
    });

    const [confirmResponse] = await Promise.all([
      h.app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${id}/confirm`,
        headers: { cookie: host.cookie },
      }),
      jobs().expirePending(),
    ]);

    expect(confirmResponse.statusCode).toBe(409);
    expect(await bookingStatus(id)).toBe('expired');
  });

  it('чистит ключи идемпотентности старше 48 часов', async () => {
    const old = new Date(Date.now() - 49 * 3_600_000);
    const fresh = new Date(Date.now() - 47 * 3_600_000);
    await h.db.kysely
      .insertInto('idempotency_keys')
      .values([
        {
          user_id: guest.id,
          key: 'old-key',
          endpoint: BOOKING_ENDPOINT,
          request_hash: 'old',
          response_status: 201,
          response_body: { ok: true } as never,
          created_at: old,
        },
        {
          user_id: guest.id,
          key: 'fresh-key',
          endpoint: BOOKING_ENDPOINT,
          request_hash: 'fresh',
          response_status: 201,
          response_body: { ok: true } as never,
          created_at: fresh,
        },
      ])
      .execute();

    const deleted = await jobs().cleanupIdempotency();
    const rows = await h.db.kysely
      .selectFrom('idempotency_keys')
      .select('key')
      .orderBy('key')
      .execute();

    expect(deleted).toBe(1);
    expect(rows.map((row) => row.key)).toEqual(['fresh-key']);
  });
});
