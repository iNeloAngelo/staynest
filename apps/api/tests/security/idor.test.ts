import { randomUUID } from 'node:crypto';
import type { InjectOptions } from 'fastify';
import type { Client } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
} from '../support/harness';
import type { Harness, TestUser } from '../support/harness';
import { futureDay, insertBookingRow, seedListing } from '../support/booking-fixtures';

const url = databaseUrl ?? '';
const activeHarnesses: Harness[] = [];

type Attack = {
  name: string;
  method: 'PATCH' | 'PUT' | 'POST' | 'DELETE';
  path: (id: string) => string;
  payload?: unknown;
};

/**
 * Общая матрица IDOR: пользователь B пытается управлять ресурсом пользователя A.
 * В каждой следующей сессии сюда добавляются новые пары ресурс/действие.
 */
const LISTING_ATTACKS: Attack[] = [
  {
    name: 'PATCH объявления',
    method: 'PATCH',
    path: (id) => `/api/v1/listings/${id}`,
    payload: { title: 'Взлом' },
  },
  {
    name: 'PUT удобств',
    method: 'PUT',
    path: (id) => `/api/v1/listings/${id}/amenities`,
    payload: { amenityIds: [] },
  },
  { name: 'POST публикации', method: 'POST', path: (id) => `/api/v1/listings/${id}/publish` },
  { name: 'POST архива', method: 'POST', path: (id) => `/api/v1/listings/${id}/archive` },
  { name: 'DELETE объявления', method: 'DELETE', path: (id) => `/api/v1/listings/${id}` },
  {
    name: 'PATCH порядка фото',
    method: 'PATCH',
    path: (id) => `/api/v1/listings/${id}/photos/order`,
    payload: { photoIds: [] },
  },
  {
    name: 'PATCH обложки фото',
    method: 'PATCH',
    path: (id) => `/api/v1/listings/${id}/photos/${randomUUID()}/cover`,
  },
  {
    name: 'DELETE фото',
    method: 'DELETE',
    path: (id) => `/api/v1/listings/${id}/photos/${randomUUID()}`,
  },
  {
    name: 'POST сезонного правила',
    method: 'POST',
    path: (id) => `/api/v1/listings/${id}/price-rules`,
    payload: {
      name: 'Взлом',
      dateFrom: '2030-07-01',
      dateTo: '2030-07-31',
      nightlyPriceMinor: 100_000,
    },
  },
  {
    name: 'PATCH сезонного правила',
    method: 'PATCH',
    path: (id) => `/api/v1/listings/${id}/price-rules/${randomUUID()}`,
    payload: { nightlyPriceMinor: 100_000 },
  },
  {
    name: 'DELETE сезонного правила',
    method: 'DELETE',
    path: (id) => `/api/v1/listings/${id}/price-rules/${randomUUID()}`,
  },
  {
    name: 'POST блокировки',
    method: 'POST',
    path: (id) => `/api/v1/listings/${id}/blocks`,
    payload: { dateFrom: '2030-07-10', dateTo: '2030-07-12' },
  },
  {
    name: 'DELETE блокировки',
    method: 'DELETE',
    path: (id) => `/api/v1/listings/${id}/blocks/${randomUUID()}`,
  },
];

async function setupPair(): Promise<{
  h: Harness;
  owner: TestUser;
  stranger: TestUser;
  id: string;
}> {
  const h = await createHarness();
  activeHarnesses.push(h);
  const owner = await createUser(h, 'owner@example.ru', 'Хозяин');
  const stranger = await createUser(h, 'stranger@example.ru', 'Посторонний');

  const created = await h.app.inject({
    method: 'POST',
    url: '/api/v1/listings',
    headers: { cookie: owner.cookie },
  });
  const id = (created.json() as { listing: { id: string } }).listing.id;

  return { h, owner, stranger, id };
}

describeDatabase('IDOR: объявления', () => {
  let client: Client;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE users RESTART IDENTITY CASCADE');
  });

  afterEach(async () => {
    for (const h of activeHarnesses.splice(0)) {
      await h.app.close();
      await h.db.close();
    }
  });

  it.each(LISTING_ATTACKS)('$name: чужой пользователь получает 404', async (attack: Attack) => {
    const { h, stranger, id } = await setupPair();

    const options: InjectOptions = {
      method: attack.method,
      url: attack.path(id),
      headers: { cookie: stranger.cookie },
    };
    if (attack.payload !== undefined) options.payload = attack.payload as InjectOptions['payload'];

    const response = await h.app.inject(options);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'listing_not_found' });

    const row = await h.db.kysely
      .selectFrom('listings')
      .select(['title', 'status', 'published_at'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ title: null, status: 'draft', published_at: null });
  });

  it('неподтверждённый чужой пользователь получает 404, а не 403', async () => {
    const { h, stranger, id } = await setupPair();

    await h.db.kysely
      .updateTable('users')
      .set({ email_verified_at: null })
      .where('id', '=', stranger.id)
      .execute();

    const response = await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${id}/publish`,
      headers: { cookie: stranger.cookie },
    });

    expect(response.statusCode).toBe(404);
  });

  it('опубликованное чужое объявление нельзя изменить или снять с публикации', async () => {
    const { h, owner, stranger, id } = await setupPair();

    await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${id}`,
      headers: { cookie: owner.cookie },
      payload: {
        title: 'Дом у озера',
        description:
          'Тихий дом с террасой и видом на озеро. Подходит для семьи из четырёх человек, есть камин и лодка.',
        city: 'Суздаль',
        addressLine: 'Лесная улица, 12',
        maxGuests: 4,
        bedrooms: 2,
        beds: 3,
        basePriceMinor: 750_000,
      },
    });
    await h.db.kysely
      .insertInto('listing_photos')
      .values(
        [0, 1, 2].map((position) => ({
          listing_id: id,
          storage_prefix: `listings/${id}/photo-${position}`,
          width: 1000,
          height: 750,
          position,
        })),
      )
      .execute();
    await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${id}/publish`,
      headers: { cookie: owner.cookie },
    });

    const patch = await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${id}`,
      headers: { cookie: stranger.cookie },
      payload: { title: 'Взлом' },
    });
    const amenities = await h.app.inject({
      method: 'PUT',
      url: `/api/v1/listings/${id}/amenities`,
      headers: { cookie: stranger.cookie },
      payload: { amenityIds: [] },
    });

    expect(patch.statusCode).toBe(404);
    expect(amenities.statusCode).toBe(404);

    const row = await h.db.kysely
      .selectFrom('listings')
      .select(['title', 'status'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ title: 'Дом у озера', status: 'published' });
  });

  it('не показывает чужой календарь хозяина', async () => {
    const { h, stranger, id } = await setupPair();

    const response = await h.app.inject({
      method: 'GET',
      url: `/api/v1/listings/${id}/calendar/host?from=2030-07-01&to=2030-07-31`,
      headers: { cookie: stranger.cookie },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'listing_not_found' });
  });

  it('не показывает чужое объявление в /me/listings', async () => {
    const { h, stranger } = await setupPair();

    const response = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: stranger.cookie },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { listings: unknown[] }).listings).toEqual([]);
  });

  it('не даёт угадать существование чужого объявления по разным ответам', async () => {
    const { h, stranger, id } = await setupPair();
    const missing = randomUUID();

    const existing = await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${id}`,
      headers: { cookie: stranger.cookie },
      payload: { title: 'Взлом' },
    });
    const absent = await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${missing}`,
      headers: { cookie: stranger.cookie },
      payload: { title: 'Взлом' },
    });

    expect(existing.statusCode).toBe(absent.statusCode);
    expect(existing.json()).toEqual(absent.json());
  });

  it('после публикации чужое объявление по-прежнему недоступно', async () => {
    const { h, owner, stranger, id } = await setupPair();

    await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${id}`,
      headers: { cookie: owner.cookie },
      payload: {
        title: 'Дом у озера',
        description:
          'Тихий дом с террасой и видом на озеро. Подходит для семьи из четырёх человек, есть камин и лодка.',
        city: 'Суздаль',
        addressLine: 'Лесная улица, 12',
        maxGuests: 4,
        bedrooms: 2,
        beds: 3,
        basePriceMinor: 750_000,
      },
    });
    await h.db.kysely
      .insertInto('listing_photos')
      .values(
        [0, 1, 2].map((position) => ({
          listing_id: id,
          storage_prefix: `listings/${id}/photo-${position}`,
          width: 1000,
          height: 750,
          position,
        })),
      )
      .execute();
    await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${id}/publish`,
      headers: { cookie: owner.cookie },
    });

    const archive = await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${id}/archive`,
      headers: { cookie: stranger.cookie },
    });
    const remove = await h.app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${id}`,
      headers: { cookie: stranger.cookie },
    });

    expect(archive.statusCode).toBe(404);
    expect(remove.statusCode).toBe(404);
  });
});

type BookingAttack = {
  name: string;
  method: 'GET' | 'POST';
  path: (id: string) => string;
  payload?: unknown;
};

const BOOKING_ATTACKS: BookingAttack[] = [
  { name: 'GET брони', method: 'GET', path: (id) => `/api/v1/bookings/${id}` },
  { name: 'POST подтверждения', method: 'POST', path: (id) => `/api/v1/bookings/${id}/confirm` },
  {
    name: 'POST отклонения',
    method: 'POST',
    path: (id) => `/api/v1/bookings/${id}/decline`,
    payload: { comment: 'Взлом' },
  },
  {
    name: 'POST отмены',
    method: 'POST',
    path: (id) => `/api/v1/bookings/${id}/cancel`,
    payload: { reason: 'Взлом' },
  },
];

describeDatabase('IDOR: брони', () => {
  let client: Client;
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let stranger: TestUser;
  let bookingId: string;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    host = await createUser(h, 'host@example.ru', 'Хозяин');
    guest = await createUser(h, 'guest@example.ru', 'Гость');
    stranger = await createUser(h, 'stranger@example.ru', 'Посторонний');
    const listingId = await seedListing(h, host.id);
    bookingId = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(20),
      to: futureDay(22),
    });
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  it.each(BOOKING_ATTACKS)('$name: посторонний получает 404', async (attack: BookingAttack) => {
    const options: InjectOptions = {
      method: attack.method,
      url: attack.path(bookingId),
      headers: { cookie: stranger.cookie },
    };
    if (attack.payload !== undefined) options.payload = attack.payload as InjectOptions['payload'];

    const response = await h.app.inject(options);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'booking_not_found' });
  });

  it('гость не может подтвердить свою заявку', async () => {
    const response = await h.app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${bookingId}/confirm`,
      headers: { cookie: guest.cookie },
    });

    expect(response.statusCode).toBe(403);
    const row = await h.db.kysely
      .selectFrom('bookings')
      .select('status')
      .where('id', '=', bookingId)
      .executeTakeFirstOrThrow();
    expect(row.status).toBe('pending');
  });

  it('хозяин и гость видят свою бронь', async () => {
    for (const user of [host, guest]) {
      const response = await h.app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${bookingId}`,
        headers: { cookie: user.cookie },
      });
      expect(response.statusCode).toBe(200);
    }
  });
});
