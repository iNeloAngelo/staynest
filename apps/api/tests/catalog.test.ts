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
