import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { BookingResponse } from '@staynest/shared';
import { addDays } from '@staynest/shared';
import {
  createBookingRequest,
  futureDay,
  insertBookingRow,
  seedListing,
} from './support/booking-fixtures';
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

async function pendingCount(h: Harness, guestId: string): Promise<number> {
  const row = await h.db.kysely
    .selectFrom('bookings')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('guest_id', '=', guestId)
    .where('status', '=', 'pending')
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

describeDatabase('создание брони', () => {
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

  it('создаёт pending, считает цену на сервере и пишет событие', async () => {
    const listingId = await seedListing(h, host.id);
    const checkIn = futureDay(20);
    const published: string[] = [];
    const unsubscribe = h.events.subscribe('booking.requested', (payload) => {
      published.push(payload.bookingId);
    });
    const before = Date.now();
    const response = await createBookingRequest(h, guest, listingId, {
      checkIn,
      checkOut: addDays(checkIn, 2),
      guestMessage: 'Приедем поздно.',
    });
    unsubscribe();
    const { booking } = response.json() as BookingResponse;

    expect(response.statusCode).toBe(201);
    expect(booking).toMatchObject({
      status: 'pending',
      checkIn,
      checkOut: addDays(checkIn, 2),
      nights: 2,
      guestsCount: 2,
      totalMinor: 250_000,
      guestMessage: 'Приедем поздно.',
      listing: { id: listingId, title: 'Дом у озера' },
      guest: { id: guest.id, displayName: 'Гость' },
    });
    expect(booking.expiresAt).not.toBeNull();
    const expiresAt = new Date(booking.expiresAt ?? '').getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 24 * 3_600_000 - 5_000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 24 * 3_600_000 + 5_000);
    expect(booking.events).toHaveLength(1);
    expect(booking.events[0]).toMatchObject({
      fromStatus: null,
      toStatus: 'pending',
      actorRole: 'guest',
    });
    expect(published).toEqual([booking.id]);

    const row = await h.db.kysely
      .selectFrom('booking_events')
      .select(['to_status', 'actor_id'])
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ to_status: 'pending', actor_id: guest.id });
  });

  it('повтор с тем же ключом и телом возвращает исходную бронь', async () => {
    const listingId = await seedListing(h, host.id);
    const key = randomUUID();
    const published: string[] = [];
    const unsubscribe = h.events.subscribe('booking.requested', (payload) => {
      published.push(payload.bookingId);
    });
    const first = await createBookingRequest(h, guest, listingId, { key });
    const second = await createBookingRequest(h, guest, listingId, { key });
    unsubscribe();

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect((second.json() as BookingResponse).booking.id).toBe(
      (first.json() as BookingResponse).booking.id,
    );
    expect(published).toHaveLength(1);
    expect(await pendingCount(h, guest.id)).toBe(1);
  });

  it('тот же ключ с другим телом даёт 422', async () => {
    const listingId = await seedListing(h, host.id);
    const key = randomUUID();
    await createBookingRequest(h, guest, listingId, { key });

    const published: string[] = [];
    const unsubscribe = h.events.subscribe('booking.requested', (payload) => {
      published.push(payload.bookingId);
    });
    const other = futureDay(40);
    const response = await createBookingRequest(h, guest, listingId, {
      key,
      checkIn: other,
      checkOut: addDays(other, 2),
    });
    unsubscribe();

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'idempotency_key_conflict' });
    expect(published).toEqual([]);
  });

  it('не запоминает ошибку: после освобождения дат тот же ключ создаёт бронь', async () => {
    const listingId = await seedListing(h, host.id);
    const key = randomUUID();
    const checkIn = futureDay(20);
    const blocker = await insertBookingRow(h, {
      listingId,
      guestId: stranger.id,
      from: checkIn,
      to: addDays(checkIn, 2),
      status: 'confirmed',
    });

    const blocked = await createBookingRequest(h, guest, listingId, {
      key,
      checkIn,
      checkOut: addDays(checkIn, 2),
    });
    await h.db.kysely.deleteFrom('bookings').where('id', '=', blocker).execute();
    const retried = await createBookingRequest(h, guest, listingId, {
      key,
      checkIn,
      checkOut: addDays(checkIn, 2),
    });

    expect(blocked.statusCode).toBe(409);
    expect(retried.statusCode).toBe(201);
    expect((retried.json() as BookingResponse).booking.status).toBe('pending');
  });

  it('конкурентные запросы с одним ключом создают одну бронь', async () => {
    const listingId = await seedListing(h, host.id);
    const key = randomUUID();

    const responses = await Promise.all([
      createBookingRequest(h, guest, listingId, { key }),
      createBookingRequest(h, guest, listingId, { key }),
    ]);
    const ids = responses.map((response) => (response.json() as BookingResponse).booking.id);

    expect(responses.every((response) => response.statusCode === 201)).toBe(true);
    expect(ids[0]).toBe(ids[1]);
    expect(await pendingCount(h, guest.id)).toBe(1);
  });

  it('требует Idempotency-Key и проверяет его формат', async () => {
    const listingId = await seedListing(h, host.id);
    const checkIn = futureDay(20);

    const missing = await h.app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: authHeaders(guest.cookie),
      payload: { listingId, checkIn, checkOut: addDays(checkIn, 2), guestsCount: 2 },
    });
    const invalid = await createBookingRequest(h, guest, listingId, { key: 'short' });

    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toMatchObject({ code: 'idempotency_key_required' });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toMatchObject({ code: 'invalid_idempotency_key' });
  });

  it('отдаёт 409 на занятые даты и 201 на смежные', async () => {
    const listingId = await seedListing(h, host.id);
    const checkIn = futureDay(20);
    await createBookingRequest(h, guest, listingId, {
      checkIn,
      checkOut: addDays(checkIn, 2),
    });

    const published: string[] = [];
    const unsubscribe = h.events.subscribe('booking.requested', (payload) => {
      published.push(payload.bookingId);
    });
    const overlap = await createBookingRequest(h, guest, listingId, {
      checkIn: addDays(checkIn, 1),
      checkOut: addDays(checkIn, 3),
    });
    unsubscribe();
    const adjacent = await createBookingRequest(h, guest, listingId, {
      checkIn: addDays(checkIn, 2),
      checkOut: addDays(checkIn, 4),
    });

    expect(overlap.statusCode).toBe(409);
    expect(overlap.json()).toMatchObject({ code: 'booking_dates_unavailable' });
    expect(published).toEqual([]);
    expect(adjacent.statusCode).toBe(201);
  });

  it('учитывает блокировку хозяина', async () => {
    const listingId = await seedListing(h, host.id);
    const checkIn = futureDay(30);
    await h.db.kysely
      .insertInto('listing_blocks')
      .values({
        listing_id: listingId,
        block_range: `[${checkIn},${addDays(checkIn, 3)})`,
        reason: 'Ремонт',
      })
      .execute();

    const response = await createBookingRequest(h, guest, listingId, {
      checkIn,
      checkOut: addDays(checkIn, 2),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'booking_dates_unavailable' });
  });

  it('освобождает даты истёкшей заявки до запуска джоба', async () => {
    const listingId = await seedListing(h, host.id);
    const checkIn = futureDay(34);
    const staleId = await insertBookingRow(h, {
      listingId,
      guestId: stranger.id,
      from: checkIn,
      to: addDays(checkIn, 2),
      expiresAt: new Date(Date.now() - 60_000),
    });

    const expired: string[] = [];
    const unsubscribe = h.events.subscribe('booking.expired', (payload) => {
      expired.push(payload.bookingId);
    });
    const quote = await h.app.inject({
      method: 'GET',
      url: `/api/v1/listings/${listingId}/quote?checkIn=${checkIn}&checkOut=${addDays(checkIn, 2)}&guests=2`,
    });
    const response = await createBookingRequest(h, guest, listingId, {
      checkIn,
      checkOut: addDays(checkIn, 2),
    });
    unsubscribe();

    expect(quote.statusCode).toBe(200);
    expect(response.statusCode).toBe(201);
    expect(expired).toEqual([staleId]);

    const stale = await h.db.kysely
      .selectFrom('bookings')
      .select('status')
      .where('id', '=', staleId)
      .executeTakeFirstOrThrow();
    expect(stale.status).toBe('expired');
  });

  it('гонка брони и блокировки даёт ровно один успех', async () => {
    const listingId = await seedListing(h, host.id);
    const checkIn = futureDay(32);

    const [bookingResponse, blockResponse] = await Promise.all([
      createBookingRequest(h, guest, listingId, {
        checkIn,
        checkOut: addDays(checkIn, 2),
      }),
      h.app.inject({
        method: 'POST',
        url: `/api/v1/listings/${listingId}/blocks`,
        headers: authHeaders(host.cookie),
        payload: {
          dateFrom: checkIn,
          dateTo: addDays(checkIn, 1),
        },
      }),
    ]);

    const statuses = [bookingResponse.statusCode, blockResponse.statusCode].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('проверяет свои даты, гостей, публикацию и владельца', async () => {
    const listingId = await seedListing(h, host.id, { maxGuests: 4, minNights: 3 });
    const draft = await seedListing(h, host.id, { status: 'draft' });
    const checkIn = futureDay(20);

    const own = await createBookingRequest(h, host, listingId, { checkIn });
    const hidden = await createBookingRequest(h, guest, draft, { checkIn });
    const tooMany = await createBookingRequest(h, guest, listingId, {
      checkIn,
      guestsCount: 5,
    });
    const short = await createBookingRequest(h, guest, listingId, {
      checkIn,
      checkOut: addDays(checkIn, 2),
    });
    const past = await createBookingRequest(h, guest, listingId, {
      checkIn: futureDay(-1),
      checkOut: futureDay(1),
    });

    expect(own.statusCode).toBe(422);
    expect(own.json()).toMatchObject({ code: 'booking_own_listing' });
    expect(hidden.statusCode).toBe(404);
    expect(hidden.json()).toMatchObject({ code: 'listing_not_found' });
    expect(tooMany.statusCode).toBe(422);
    expect(tooMany.json()).toMatchObject({ code: 'guests_exceed_capacity' });
    expect(short.statusCode).toBe(422);
    expect(short.json()).toMatchObject({ code: 'min_nights_not_met' });
    expect(past.statusCode).toBe(422);
    expect(past.json()).toMatchObject({ code: 'stay_in_past' });
  });

  it('требует подтверждённый email при включённом флаге', async () => {
    const listingId = await seedListing(h, host.id);
    await h.db.kysely
      .updateTable('users')
      .set({ email_verified_at: null })
      .where('id', '=', stranger.id)
      .execute();

    const response = await createBookingRequest(h, stranger, listingId, {
      checkIn: futureDay(20),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'email_not_verified' });
  });

  it('не даёт бронировать деактивированному пользователю', async () => {
    const listingId = await seedListing(h, host.id);
    await h.db.kysely
      .updateTable('users')
      .set({ is_active: false })
      .where('id', '=', stranger.id)
      .execute();

    const response = await createBookingRequest(h, stranger, listingId, {
      checkIn: futureDay(20),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'unauthorized' });
  });

  it('не даёт гостю больше пяти активных заявок', async () => {
    const listingId = await seedListing(h, host.id);

    for (let index = 0; index < 5; index += 1) {
      const checkIn = futureDay(20 + index * 3);
      const response = await createBookingRequest(h, guest, listingId, {
        checkIn,
        checkOut: addDays(checkIn, 2),
      });
      expect(response.statusCode).toBe(201);
    }

    const sixth = await createBookingRequest(h, guest, listingId, {
      checkIn: futureDay(40),
      checkOut: futureDay(42),
    });
    expect(sixth.statusCode).toBe(429);
    expect(sixth.json()).toMatchObject({ code: 'too_many_pending_bookings' });
  });

  it('считает только активные pending, а не все брони', async () => {
    const listingId = await seedListing(h, host.id);
    for (let index = 0; index < 5; index += 1) {
      await insertBookingRow(h, {
        listingId,
        guestId: guest.id,
        from: futureDay(20 + index * 3),
        to: futureDay(22 + index * 3),
        status: index % 2 === 0 ? 'confirmed' : 'cancelled_by_guest',
      });
    }

    const response = await createBookingRequest(h, guest, listingId, {
      checkIn: futureDay(40),
      checkOut: futureDay(42),
    });

    expect(response.statusCode).toBe(201);
  });

  it('параллельные заявки упираются ровно в лимит пяти', async () => {
    const listingId = await seedListing(h, host.id);
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) => {
        const checkIn = futureDay(60 + index * 3);
        return createBookingRequest(h, guest, listingId, {
          checkIn,
          checkOut: addDays(checkIn, 2),
        });
      }),
    );
    const success = responses.filter((response) => response.statusCode === 201);
    const limited = responses.filter((response) => response.statusCode === 429);

    expect(success).toHaveLength(5);
    expect(limited).toHaveLength(1);
    expect(limited[0]?.json()).toMatchObject({ code: 'too_many_pending_bookings' });
  });

  it('не даёт создать бронь на уже отменённые даты после освобождения', async () => {
    const listingId = await seedListing(h, host.id);
    const checkIn = futureDay(20);
    const id = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: checkIn,
      to: addDays(checkIn, 2),
      status: 'cancelled_by_guest',
    });

    const response = await createBookingRequest(h, guest, listingId, {
      checkIn,
      checkOut: addDays(checkIn, 2),
    });

    expect(response.statusCode).toBe(201);
    expect((response.json() as BookingResponse).booking.id).not.toBe(id);
  });

  it('ограничивает частоту создания брони на инстансе', async () => {
    const limited = await createHarness({
      booking: {
        requestTtlHours: 24,
        expiryWarningHours: 3,
        maxActivePending: 5,
        rateLimit: { max: 2, windowMs: 60_000 },
      },
    });

    try {
      const user = await createUser(limited, 'rate@example.ru', 'Лимит');
      const listingId = await seedListing(limited, host.id);
      const key = randomUUID();

      const first = await createBookingRequest(limited, user, listingId, {
        key,
        checkIn: futureDay(60),
      });
      const second = await createBookingRequest(limited, user, listingId, {
        checkIn: futureDay(63),
      });
      const replay = await createBookingRequest(limited, user, listingId, {
        key,
        checkIn: futureDay(60),
      });
      const third = await createBookingRequest(limited, user, listingId, {
        checkIn: futureDay(66),
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      expect(replay.statusCode).toBe(201);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(third.statusCode).toBe(429);
      expect(third.headers['retry-after']).toBeDefined();
      expect(third.json()).toMatchObject({ code: 'booking_rate_limited' });

      const otherUser = await createUser(limited, 'rate-other@example.ru', 'Другой');
      const other = await createBookingRequest(limited, otherUser, listingId, {
        checkIn: futureDay(70),
      });
      expect(other.statusCode).toBe(201);
    } finally {
      await limited.app.close();
      await limited.db.close();
    }
  });
});
