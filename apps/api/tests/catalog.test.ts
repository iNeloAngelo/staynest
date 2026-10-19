import type { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { PublicListing, PublicListingsResponse } from '@staynest/shared';
import {
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
} from './support/harness';
import type { Harness, TestUser } from './support/harness';

const url = databaseUrl ?? '';
const DESCRIPTION =
  'Тихий дом с террасой, камином и видом на сосновый лес. Подходит для семьи, есть лодка и место для костра.';
const OWNER = '11111111-1111-4111-8111-111111111111';

type SeedOptions = {
  title?: string;
  description?: string;
  city?: string;
  region?: string | null;
  type?: 'house' | 'cottage' | 'cabin' | 'villa' | 'townhouse';
  status?: 'draft' | 'published' | 'archived';
  maxGuests?: number;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  basePriceMinor?: number;
  weekendPriceMinor?: number | null;
  cleaningFeeMinor?: number;
  minNights?: number;
  maxNights?: number;
  lat?: string | null;
  lng?: string | null;
  publishedAt?: Date | null;
  photoCount?: number;
  amenityIds?: number[];
};

// eslint-disable-next-line complexity -- фикстура задаёт дефолты для всех полей объявления.
async function seedListing(h: Harness, options: SeedOptions = {}): Promise<string> {
  const published = options.status !== 'draft' && options.status !== 'archived';
  const row = await h.db.kysely
    .insertInto('listings')
    .values({
      owner_id: OWNER,
      status: options.status ?? 'published',
      type: options.type ?? 'house',
      title: options.title ?? 'Дом у озера',
      description: options.description ?? DESCRIPTION,
      country: 'RU',
      region: options.region === undefined ? 'Владимирская область' : options.region,
      city: options.city ?? 'Суздаль',
      address_line: 'Частный адрес, 12',
      lat: options.lat === undefined ? '55.755800' : options.lat,
      lng: options.lng === undefined ? '37.617300' : options.lng,
      max_guests: options.maxGuests ?? 4,
      bedrooms: options.bedrooms ?? 2,
      beds: options.beds ?? 3,
      bathrooms: options.bathrooms ?? 1,
      base_price_minor: options.basePriceMinor ?? 750_000,
      weekend_price_minor: options.weekendPriceMinor ?? null,
      cleaning_fee_minor: options.cleaningFeeMinor ?? 0,
      min_nights: options.minNights ?? 1,
      max_nights: options.maxNights ?? 30,
      house_rules: 'Курить нельзя. С животными — по договорённости.',
      published_at:
        options.publishedAt === undefined
          ? published
            ? new Date('2026-10-01T10:00:00.000Z')
            : null
          : options.publishedAt,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const photos = Array.from({ length: options.photoCount ?? 1 }, (_, index) => ({
    listing_id: row.id,
    storage_prefix: `listings/${row.id}/photo-${index}`,
    width: 1000,
    height: 750,
    position: index,
    is_cover: index === 0,
  }));

  if (photos.length > 0) {
    const inserted = await h.db.kysely
      .insertInto('listing_photos')
      .values(photos)
      .returning('id')
      .execute();
    await h.db.kysely
      .updateTable('listings')
      .set({ cover_photo_id: inserted[0]?.id })
      .where('id', '=', row.id)
      .execute();
  }

  if (options.amenityIds?.length) {
    await h.db.kysely
      .insertInto('listing_amenities')
      .values(
        options.amenityIds.map((amenityId) => ({ listing_id: row.id, amenity_id: amenityId })),
      )
      .execute();
  }

  return row.id;
}

async function catalog(
  h: Harness,
  query: Record<string, string | number | undefined> = {},
): Promise<PublicListingsResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  const response = await h.app.inject({
    method: 'GET',
    url: `/api/v1/listings?${params.toString()}`,
  });
  expect(response.statusCode).toBe(200);
  return response.json() as PublicListingsResponse;
}

type BookingSeed = {
  checkIn: string;
  checkOut: string;
  status?:
    | 'pending'
    | 'confirmed'
    | 'declined'
    | 'cancelled_by_guest'
    | 'cancelled_by_host'
    | 'expired'
    | 'completed';
};

async function seedBooking(h: Harness, listingId: string, options: BookingSeed): Promise<void> {
  await h.db.pool.query(
    `INSERT INTO bookings (
       listing_id, guest_id, stay_range, guests_count, status,
       total_minor, currency, price_breakdown
     )
     VALUES ($1, $2, daterange($3::date, $4::date, '[)'), 2, $5::booking_status, 0, 'RUB', '{}'::jsonb)`,
    [listingId, OWNER, options.checkIn, options.checkOut, options.status ?? 'confirmed'],
  );
}

async function seedBlock(
  h: Harness,
  listingId: string,
  dateFrom: string,
  dateTo: string,
): Promise<void> {
  await h.db.pool.query(
    `INSERT INTO listing_blocks (listing_id, block_range, reason)
     VALUES ($1, daterange($2::date, $3::date, '[)'), 'Тест')`,
    [listingId, dateFrom, dateTo],
  );
}

async function seedRule(
  h: Harness,
  listingId: string,
  input: {
    dateFrom: string;
    dateTo: string;
    nightlyPriceMinor: number;
    priority?: number;
  },
): Promise<void> {
  await h.db.pool.query(
    `INSERT INTO listing_price_rules (
       listing_id, name, date_from, date_to, nightly_price_minor, priority
     )
     VALUES ($1, 'Тест', $2::date, $3::date, $4, $5)`,
    [listingId, input.dateFrom, input.dateTo, input.nightlyPriceMinor, input.priority ?? 0],
  );
}

function sorted(values: string[]): string[] {
  return [...values].sort();
}

function ids(body: PublicListingsResponse): string[] {
  return body.listings.map((listing) => listing.id);
}

describeDatabase('catalog API', () => {
  let client: Client;
  let h: Harness;
  let host: TestUser;
  let amenityWifi: number;
  let amenitySauna: number;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    host = await createUser(h, 'host@example.ru', 'Хозяин');

    const amenities = await h.db.kysely
      .selectFrom('amenities')
      .select(['id', 'code'])
      .where('code', 'in', ['wifi', 'sauna'])
      .execute();
    amenityWifi = amenities.find((row) => row.code === 'wifi')!.id;
    amenitySauna = amenities.find((row) => row.code === 'sauna')!.id;

    await h.db.kysely
      .insertInto('users')
      .values({
        id: OWNER,
        email: 'seed-owner@example.ru',
        display_name: 'Seed',
        locale: 'ru',
        email_verified_at: new Date(),
      })
      .onConflict((conflict) => conflict.column('id').doNothing())
      .execute();
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE listings RESTART IDENTITY CASCADE');
  });

  it('показывает только опубликованные дома и публичные поля', async () => {
    const published = await seedListing(h, { title: 'Дом у озера', photoCount: 2 });
    await seedListing(h, { title: 'Черновик', status: 'draft' });
    await seedListing(h, { title: 'Архив', status: 'archived' });

    const body = await catalog(h);

    expect(ids(body)).toEqual([published]);
    expect(body.nextCursor).toBeNull();

    const [listing] = body.listings;
    expect(listing).toMatchObject({
      title: 'Дом у озера',
      city: 'Суздаль',
      approxLat: 55.76,
      approxLng: 37.62,
      maxGuests: 4,
      basePriceMinor: 750_000,
      photoCount: 2,
    });
    expect(listing?.coverPhoto?.isCover).toBe(true);
    expect(listing).not.toHaveProperty('addressLine');
    expect(listing).not.toHaveProperty('lat');
    expect(listing).not.toHaveProperty('lng');
    expect(listing).not.toHaveProperty('pendingBookingsCount');
    expect(listing).not.toHaveProperty('status');
    expect(host.id).toBeTruthy();
  });

  it('ищет по тексту названия и по городу', async () => {
    const lake = await seedListing(h, { title: 'Дом у озера' });
    const city = await seedListing(h, { title: 'Лесной коттедж', city: 'Плёс' });
    await seedListing(h, { title: 'Городская квартира', city: 'Москва', type: 'townhouse' });

    expect(ids(await catalog(h, { q: 'озеро' }))).toEqual([lake]);
    expect(ids(await catalog(h, { q: 'Плёс' }))).toEqual([city]);
    expect(ids(await catalog(h, { q: '100%' }))).toEqual([]);
  });

  it('фильтрует по городу, гостям, цене и спальням', async () => {
    const cheap = await seedListing(h, {
      title: 'Дешёвый',
      city: 'Суздаль',
      maxGuests: 2,
      bedrooms: 1,
      basePriceMinor: 300_000,
    });
    const expensive = await seedListing(h, {
      title: 'Дорогой',
      city: 'Суздаль',
      maxGuests: 6,
      bedrooms: 3,
      basePriceMinor: 900_000,
    });
    const other = await seedListing(h, {
      title: 'Другой город',
      city: 'Кострома',
      maxGuests: 8,
      bedrooms: 4,
      basePriceMinor: 500_000,
    });

    expect(sorted(ids(await catalog(h, { city: 'Суздаль' })))).toEqual(sorted([cheap, expensive]));
    expect(sorted(ids(await catalog(h, { guests: 5 })))).toEqual(sorted([expensive, other]));
    expect(ids(await catalog(h, { priceMin: 400_000, priceMax: 800_000 }))).toEqual([other]);
    expect(ids(await catalog(h, { priceMin: 600_000 }))).toEqual([expensive]);
    expect(sorted(ids(await catalog(h, { priceMax: 600_000 })))).toEqual(sorted([cheap, other]));
    expect(sorted(ids(await catalog(h, { bedroomsMin: 3 })))).toEqual(sorted([expensive, other]));
    expect(ids(await catalog(h, { city: 'Суздаль', guests: 5 }))).toEqual([expensive]);
  });

  it('фильтрует по типу и требует все выбранные удобства', async () => {
    const villa = await seedListing(h, {
      title: 'Вилла',
      type: 'villa',
      amenityIds: [amenityWifi, amenitySauna],
    });
    const house = await seedListing(h, {
      title: 'Дом у реки',
      type: 'house',
      amenityIds: [amenityWifi],
    });
    await seedListing(h, { title: 'Домик', type: 'cabin', amenityIds: [amenitySauna] });

    expect(sorted(ids(await catalog(h, { type: 'villa,house' })))).toEqual(sorted([villa, house]));
    expect(ids(await catalog(h, { amenities: `${amenityWifi},${amenitySauna}` }))).toEqual([villa]);
    expect(sorted(ids(await catalog(h, { amenities: amenityWifi })))).toEqual(
      sorted([villa, house]),
    );
    expect(sorted(ids(await catalog(h, { amenities: `${amenityWifi},${amenityWifi}` })))).toEqual(
      sorted([villa, house]),
    );
    expect(ids(await catalog(h, { 'type[]': 'villa' }))).toEqual([villa]);
  });

  it('сортирует по цене и отдаёт все страницы без дублей при одинаковой цене', async () => {
    for (let index = 0; index < 5; index += 1) {
      await seedListing(h, {
        title: `Дом ${index}`,
        basePriceMinor: 500_000,
        publishedAt: new Date(`2026-10-0${index + 1}T10:00:00.000Z`),
      });
    }

    const seen: string[] = [];
    let cursor: string | null = null;

    do {
      const body = await catalog(h, { sort: 'price_asc', limit: 2, cursor: cursor ?? undefined });
      seen.push(...ids(body));
      cursor = body.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it('сортирует по новизне и цене в обе стороны', async () => {
    const old = await seedListing(h, {
      title: 'Старый',
      basePriceMinor: 100_000,
      publishedAt: new Date('2026-09-01T10:00:00.000Z'),
    });
    const fresh = await seedListing(h, {
      title: 'Новый',
      basePriceMinor: 300_000,
      publishedAt: new Date('2026-10-01T10:00:00.000Z'),
    });

    expect(ids(await catalog(h, { sort: 'newest' }))).toEqual([fresh, old]);
    expect(ids(await catalog(h, { sort: 'price_asc' }))).toEqual([old, fresh]);
    expect(ids(await catalog(h, { sort: 'price_desc' }))).toEqual([fresh, old]);
  });

  it('курсор релевантности не теряет и не повторяет строки', async () => {
    for (let index = 0; index < 4; index += 1) {
      await seedListing(h, {
        title: `Дом у озера ${index}`,
        publishedAt: new Date(`2026-10-0${index + 1}T10:00:00.000Z`),
      });
    }

    const seen: string[] = [];
    let cursor: string | null = null;

    do {
      const body = await catalog(h, {
        q: 'озеро',
        limit: 2,
        cursor: cursor ?? undefined,
      });
      seen.push(...ids(body));
      cursor = body.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(4);
    expect(new Set(seen).size).toBe(4);
  });

  it('курсор newest не теряет микросекунды published_at', async () => {
    const times = [
      '2026-10-01 10:00:00.123900+00',
      '2026-10-01 10:00:00.123456+00',
      '2026-10-01 10:00:00.123100+00',
    ];
    const listingIds: string[] = [];

    for (let index = 0; index < times.length; index += 1) {
      const id = await seedListing(h, { title: `Микросекунды ${index}` });
      listingIds.push(id);
      await h.db.pool.query('update listings set published_at = $1 where id = $2', [
        times[index],
        id,
      ]);
    }

    const seen: string[] = [];
    let cursor: string | null = null;

    do {
      const body = await catalog(h, { sort: 'newest', limit: 1, cursor: cursor ?? undefined });
      seen.push(...ids(body));
      cursor = body.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
    expect(sorted(seen)).toEqual(sorted(listingIds));
  });

  it('скрывает published без published_at и не падает в 500', async () => {
    const broken = await seedListing(h, { title: 'Без даты', publishedAt: null });

    expect(ids(await catalog(h))).toEqual([]);

    const response = await h.app.inject({ method: 'GET', url: `/api/v1/listings/${broken}` });
    expect(response.statusCode).toBe(404);
  });

  it('курсор newest выдерживает одинаковый published_at', async () => {
    const same = new Date('2026-10-10T10:00:00.000Z');
    for (let index = 0; index < 3; index += 1) {
      await seedListing(h, { title: `Одинаковая дата ${index}`, publishedAt: same });
    }

    const seen: string[] = [];
    let cursor: string | null = null;

    do {
      const body = await catalog(h, { sort: 'newest', limit: 2, cursor: cursor ?? undefined });
      seen.push(...ids(body));
      cursor = body.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
  });

  it('отвергает курсор релевантности от другого q', async () => {
    await seedListing(h, { title: 'Дом у озера' });
    await seedListing(h, { title: 'Другой дом у озера' });
    const first = await catalog(h, { q: 'озеро', limit: 1 });
    const cursor = first.nextCursor ?? '';

    const response = await h.app.inject({
      method: 'GET',
      url: `/api/v1/listings?q=${encodeURIComponent('лес')}&cursor=${encodeURIComponent(cursor)}`,
    });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { code: string }).code).toBe('invalid_cursor');
  });

  it('поддерживает snake_case и повторяющиеся параметры из ТЗ', async () => {
    const wifi = await seedListing(h, { title: 'С Wi-Fi', amenityIds: [amenityWifi] });
    const sauna = await seedListing(h, {
      title: 'С сауной',
      basePriceMinor: 900_000,
      amenityIds: [amenitySauna],
    });

    const response = await h.app.inject({
      method: 'GET',
      url: '/api/v1/listings?price_min=100&price_max=1000000&bedrooms_min=2&type[]=house&amenities[]=1&amenities[]=1',
    });
    const body = response.json() as PublicListingsResponse;

    expect(response.statusCode).toBe(200);
    expect(ids(body)).toEqual([wifi]);
    expect(sauna).toBeTruthy();
  });

  it('отдаёт 422 на amenity id вне smallint', async () => {
    const response = await h.app.inject({
      method: 'GET',
      url: '/api/v1/listings?amenities=99999',
    });

    expect(response.statusCode).toBe(422);
  });

  it('скрывает дома с активными бронями и возвращает освободившиеся даты', async () => {
    const pending = await seedListing(h, { title: 'Pending' });
    const confirmed = await seedListing(h, { title: 'Confirmed' });
    const declined = await seedListing(h, { title: 'Declined' });
    const cancelled = await seedListing(h, { title: 'Cancelled' });
    const cancelledByHost = await seedListing(h, { title: 'Cancelled by host' });
    const expired = await seedListing(h, { title: 'Expired' });
    const completed = await seedListing(h, { title: 'Completed' });

    await seedBooking(h, pending, {
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      status: 'pending',
    });
    await seedBooking(h, confirmed, {
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      status: 'confirmed',
    });
    await seedBooking(h, declined, {
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      status: 'declined',
    });
    await seedBooking(h, cancelled, {
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      status: 'cancelled_by_guest',
    });
    await seedBooking(h, cancelledByHost, {
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      status: 'cancelled_by_host',
    });
    await seedBooking(h, expired, {
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      status: 'expired',
    });
    await seedBooking(h, completed, {
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      status: 'completed',
    });

    const body = await catalog(h, { check_in: '2026-12-10', check_out: '2026-12-12' });

    expect(sorted(ids(body))).toEqual(
      sorted([declined, cancelled, cancelledByHost, expired, completed]),
    );
  });

  it('разрешает смежные даты и учитывает блокировки хозяина', async () => {
    const booked = await seedListing(h, { title: 'С бронью' });
    const blocked = await seedListing(h, { title: 'С блокировкой' });
    const partial = await seedListing(h, { title: 'Частичное пересечение' });
    await seedBooking(h, booked, { checkIn: '2026-12-10', checkOut: '2026-12-12' });
    await seedBooking(h, partial, { checkIn: '2026-12-09', checkOut: '2026-12-11' });
    await seedBlock(h, blocked, '2026-12-10', '2026-12-12');

    const same = await catalog(h, { checkIn: '2026-12-10', checkOut: '2026-12-12' });
    expect(ids(same)).toEqual([]);

    const afterPartial = await catalog(h, { checkIn: '2026-12-11', checkOut: '2026-12-12' });
    expect(ids(afterPartial)).toContain(partial);

    const afterBooking = await catalog(h, { checkIn: '2026-12-12', checkOut: '2026-12-14' });
    expect(sorted(ids(afterBooking))).toEqual(sorted([booked, blocked, partial]));

    const beforeBooking = await catalog(h, { checkIn: '2026-12-08', checkOut: '2026-12-10' });
    expect(sorted(ids(beforeBooking))).toEqual(sorted([booked, blocked]));

    const beforeBlock = await catalog(h, { checkIn: '2026-12-08', checkOut: '2026-12-10' });
    expect(ids(beforeBlock)).toContain(blocked);

    const afterBlock = await catalog(h, { checkIn: '2026-12-12', checkOut: '2026-12-14' });
    expect(ids(afterBlock)).toContain(blocked);
  });

  it('считает стоимость за период и совпадает с /quote', async () => {
    const id = await seedListing(h, {
      title: 'Дом с сезоном',
      basePriceMinor: 100_000,
      weekendPriceMinor: 150_000,
      cleaningFeeMinor: 50_000,
      minNights: 1,
      maxNights: 30,
    });
    await seedRule(h, id, {
      dateFrom: '2026-12-11',
      dateTo: '2026-12-11',
      nightlyPriceMinor: 200_000,
      priority: 1,
    });

    const body = await catalog(h, { check_in: '2026-12-10', check_out: '2026-12-14' });
    const listing = body.listings.find((item) => item.id === id);

    expect(listing?.stayPrice).toMatchObject({
      checkIn: '2026-12-10',
      checkOut: '2026-12-14',
      nights: 4,
      nightlyTotalMinor: 550_000,
      cleaningFeeMinor: 50_000,
      totalMinor: 600_000,
      currency: 'RUB',
    });

    const quoteResponse = await h.app.inject({
      method: 'GET',
      url: `/api/v1/listings/${id}/quote?check_in=2026-12-10&check_out=2026-12-14&guests=2`,
    });
    const { quote } = quoteResponse.json() as { quote: { totalMinor: number } };
    expect(quote.totalMinor).toBe(listing?.stayPrice?.totalMinor);
  });

  it('без дат не считает период и возвращает null', async () => {
    await seedListing(h);
    const body = await catalog(h);

    expect(body.listings[0]?.stayPrice).toBeNull();
  });

  it('отдаёт 422 на неполные, неверные и слишком длинные даты', async () => {
    const cases = [
      'check_in=2026-12-10',
      'check_out=2026-12-10',
      'check_in=2026-12-12&check_out=2026-12-10',
      'check_in=2026-02-30&check_out=2026-03-02',
      'check_in=2026-12-10&check_out=2028-12-10',
    ];

    for (const query of cases) {
      const response = await h.app.inject({
        method: 'GET',
        url: `/api/v1/listings?${query}`,
      });
      expect(response.statusCode).toBe(422);
      expect(response.headers['content-type']).toContain('application/problem+json');
    }
  });

  it('пагинация с датами не теряет и не повторяет дома', async () => {
    const available: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const id = await seedListing(h, {
        title: `Свободный ${index}`,
        basePriceMinor: 500_000,
      });
      available.push(id);
    }
    const busy = await seedListing(h, { title: 'Занятый', basePriceMinor: 500_000 });
    await seedBooking(h, busy, { checkIn: '2026-12-10', checkOut: '2026-12-12' });

    const seen: string[] = [];
    let cursor: string | null = null;

    do {
      const body = await catalog(h, {
        check_in: '2026-12-10',
        check_out: '2026-12-12',
        sort: 'price_asc',
        limit: 2,
        cursor: cursor ?? undefined,
      });
      seen.push(...ids(body));
      cursor = body.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect(sorted(seen)).toEqual(sorted(available));
  });

  it('пагинация релевантности с датами не теряет строки', async () => {
    for (let index = 0; index < 4; index += 1) {
      await seedListing(h, { title: `Дом у озера ${index}` });
    }
    const busy = await seedListing(h, { title: 'Дом у озера занятый' });
    await seedBooking(h, busy, { checkIn: '2026-12-10', checkOut: '2026-12-12' });

    const seen: string[] = [];
    let cursor: string | null = null;

    do {
      const body = await catalog(h, {
        q: 'озеро',
        check_in: '2026-12-10',
        check_out: '2026-12-12',
        limit: 2,
        cursor: cursor ?? undefined,
      });
      seen.push(...ids(body));
      cursor = body.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(4);
    expect(new Set(seen).size).toBe(4);
    expect(seen).not.toContain(busy);
  });

  it('отдаёт карточку дома без адреса и точных координат', async () => {
    const id = await seedListing(h, { photoCount: 3, amenityIds: [amenityWifi, amenitySauna] });

    const response = await h.app.inject({ method: 'GET', url: `/api/v1/listings/${id}` });
    const { listing } = response.json() as { listing: PublicListing };

    expect(response.statusCode).toBe(200);
    expect(listing.title).toBe('Дом у озера');
    expect(listing.photos).toHaveLength(3);
    expect(listing.amenities.map((amenity) => amenity.code)).toEqual(['wifi', 'sauna']);
    expect(listing.houseRules).toContain('Курить нельзя');
    expect(listing.approxLat).toBe(55.76);
    expect(listing).not.toHaveProperty('addressLine');
    expect(listing).not.toHaveProperty('lat');
    expect(listing).not.toHaveProperty('lng');
    expect(listing).not.toHaveProperty('pendingBookingsCount');
    expect(listing).not.toHaveProperty('ownerId');
    expect(listing).not.toHaveProperty('status');
  });

  it('не показывает черновик и архив по прямой ссылке', async () => {
    const draft = await seedListing(h, { status: 'draft' });
    const archived = await seedListing(h, { status: 'archived' });

    for (const id of [draft, archived]) {
      const response = await h.app.inject({ method: 'GET', url: `/api/v1/listings/${id}` });
      expect(response.statusCode).toBe(404);
      expect((response.json() as { code: string }).code).toBe('listing_not_found');
    }

    const broken = await h.app.inject({ method: 'GET', url: '/api/v1/listings/not-a-uuid' });
    expect(broken.statusCode).toBe(404);
    expect((broken.json() as { code: string }).code).toBe('listing_not_found');
  });

  it('отвечает 400 на битый курсор и 422 на неверный лимит', async () => {
    const badCursor = await h.app.inject({ method: 'GET', url: '/api/v1/listings?cursor=zzz' });
    expect(badCursor.statusCode).toBe(400);
    expect((badCursor.json() as { code: string }).code).toBe('invalid_cursor');

    const badLimit = await h.app.inject({ method: 'GET', url: '/api/v1/listings?limit=100' });
    expect(badLimit.statusCode).toBe(422);
  });

  it('подсказывает города из опубликованных объявлений', async () => {
    await seedListing(h, { city: 'Суздаль' });
    await seedListing(h, { city: 'Суздаль' });
    await seedListing(h, { city: 'Кострома' });

    const response = await h.app.inject({
      method: 'GET',
      url: '/api/v1/cities?q=%D1%81%D1%83%D0%B7',
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { cities: string[] }).cities).toEqual(['Суздаль']);
    expect(response.headers['cache-control']).toContain('public');

    const all = await h.app.inject({ method: 'GET', url: '/api/v1/cities' });
    expect((all.json() as { cities: string[] }).cities).toEqual(['Суздаль', 'Кострома']);
  });
});
