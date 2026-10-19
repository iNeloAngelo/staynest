import { hash } from '@node-rs/argon2';
import type { Client } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { usersService } from '../src/modules/users/index';
import {
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
  TEST_PASSWORD,
} from './support/harness';
import type { Harness, TestUser } from './support/harness';

const url = databaseUrl ?? '';
const activeHarnesses: Harness[] = [];

async function setup(): Promise<{ h: Harness; host: TestUser }> {
  const h = await createHarness();
  activeHarnesses.push(h);
  const host = await createUser(h, 'host@example.ru', 'Хозяин');
  return { h, host };
}

function authCookie(user: TestUser): Record<string, string> {
  return { cookie: user.cookie };
}

async function createDraft(h: Harness, user: TestUser): Promise<string> {
  const response = await h.app.inject({
    method: 'POST',
    url: '/api/v1/listings',
    headers: authCookie(user),
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { listing: { id: string } }).listing.id;
}

async function patchListing(
  h: Harness,
  user: TestUser,
  id: string,
  payload: Record<string, unknown>,
) {
  return h.app.inject({
    method: 'PATCH',
    url: `/api/v1/listings/${id}`,
    headers: authCookie(user),
    payload,
  });
}

async function fillRequired(h: Harness, user: TestUser, id: string) {
  const response = await patchListing(h, user, id, {
    title: 'Дом у озера',
    description:
      'Тихий дом с террасой и видом на озеро. Подходит для семьи из четырёх человек, есть камин и лодка.',
    city: 'Суздаль',
    addressLine: 'Лесная улица, 12',
    maxGuests: 4,
    bedrooms: 2,
    beds: 3,
    basePriceMinor: 750_000,
  });
  expect(response.statusCode).toBe(200);
}

async function addPhotos(h: Harness, listingId: string, count: number): Promise<void> {
  await h.db.kysely
    .insertInto('listing_photos')
    .values(
      Array.from({ length: count }, (_, index) => ({
        listing_id: listingId,
        storage_prefix: `listings/${listingId}/photo-${index}`,
        width: 1000,
        height: 750,
        position: index,
      })),
    )
    .execute();
}

async function insertActiveBooking(h: Harness, listingId: string): Promise<string> {
  const guest = await usersService.create(h.db.kysely, {
    email: `guest-${Date.now()}@example.ru`,
    passwordHash: await hash(TEST_PASSWORD),
    displayName: 'Гость',
    locale: 'ru',
    emailVerifiedAt: new Date(),
  });

  const booking = await h.db.kysely
    .insertInto('bookings')
    .values({
      listing_id: listingId,
      guest_id: guest.id,
      stay_range: '[2027-01-10,2027-01-12)',
      guests_count: 2,
      total_minor: 1_000_000,
      currency: 'RUB',
      price_breakdown: { nights: [] },
      status: 'pending',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return booking.id;
}

describeDatabase('listings API', () => {
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

  it('отдаёт справочник удобств без авторизации', async () => {
    const { h } = await setup();

    const response = await h.app.inject({ method: 'GET', url: '/api/v1/amenities' });
    const body = response.json() as { amenities: Array<{ code: string; sortOrder: number }> };

    expect(response.statusCode).toBe(200);
    expect(body.amenities).toHaveLength(14);
    expect(body.amenities[0]).toHaveProperty('nameRu');
    const orders = body.amenities.map((amenity) => amenity.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(response.headers['cache-control']).toContain('public');
  });

  it('создаёт пустой черновик и показывает его в моих объявлениях', async () => {
    const { h, host } = await setup();

    const created = await h.app.inject({
      method: 'POST',
      url: '/api/v1/listings',
      headers: authCookie(host),
      payload: {},
    });
    const listing = (created.json() as { listing: Record<string, unknown> }).listing;

    expect(created.statusCode).toBe(201);
    expect(listing).toMatchObject({
      status: 'draft',
      title: null,
      city: null,
      basePriceMinor: null,
      pendingBookingsCount: 0,
    });
    expect(listing.amenities).toEqual([]);

    const mine = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: authCookie(host),
    });
    const body = mine.json() as { listings: Array<{ id: string }> };

    expect(mine.statusCode).toBe(200);
    expect(mine.headers['cache-control']).toBe('private, no-store');
    expect(body.listings.map((row) => row.id)).toEqual([listing.id]);
  });

  it('правит черновик и проверяет диапазон сроков', async () => {
    const { h, host } = await setup();
    const id = await createDraft(h, host);

    const updated = await patchListing(h, host, id, {
      title: 'Домик в лесу',
      city: 'Кострома',
      minNights: 2,
      maxNights: 7,
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      listing: { title: 'Домик в лесу', city: 'Кострома', minNights: 2, maxNights: 7 },
    });

    const invalid = await patchListing(h, host, id, { minNights: 9 });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toMatchObject({ code: 'validation_error' });
  });

  it('заменяет удобства и отвергает неизвестные id', async () => {
    const { h, host } = await setup();
    const id = await createDraft(h, host);

    const replaced = await h.app.inject({
      method: 'PUT',
      url: `/api/v1/listings/${id}/amenities`,
      headers: authCookie(host),
      payload: { amenityIds: [1, 2] },
    });
    expect(replaced.statusCode).toBe(200);
    expect(
      (replaced.json() as { listing: { amenities: unknown[] } }).listing.amenities,
    ).toHaveLength(2);

    const cleared = await h.app.inject({
      method: 'PUT',
      url: `/api/v1/listings/${id}/amenities`,
      headers: authCookie(host),
      payload: { amenityIds: [] },
    });
    expect(cleared.statusCode).toBe(200);
    expect(
      (cleared.json() as { listing: { amenities: unknown[] } }).listing.amenities,
    ).toHaveLength(0);

    const unknown = await h.app.inject({
      method: 'PUT',
      url: `/api/v1/listings/${id}/amenities`,
      headers: authCookie(host),
      payload: { amenityIds: [9999] },
    });
    expect(unknown.statusCode).toBe(422);
    expect(unknown.json()).toMatchObject({ code: 'validation_error' });
  });

  it('публикация без обязательных полей возвращает список ошибок', async () => {
    const { h, host } = await setup();
    const id = await createDraft(h, host);

    const response = await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${id}/publish`,
      headers: authCookie(host),
    });

    expect(response.statusCode).toBe(422);
    const body = response.json() as { code: string; errors: Array<{ field: string }> };
    expect(body.code).toBe('listing_incomplete');
    expect(body.errors.map((error) => error.field)).toEqual([
      'title',
      'description',
      'city',
      'addressLine',
      'maxGuests',
      'bedrooms',
      'beds',
      'basePriceMinor',
      'photos',
    ]);
  });

  it('публикует заполненное объявление с тремя фото и шлёт событие', async () => {
    const { h, host } = await setup();
    const id = await createDraft(h, host);
    await fillRequired(h, host, id);
    await addPhotos(h, id, 3);

    let published: unknown;
    h.events.subscribe('listing.published', (payload) => {
      published = payload;
    });

    const response = await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${id}/publish`,
      headers: authCookie(host),
    });
    const body = response.json() as { listing: { status: string; publishedAt: string | null } };

    expect(response.statusCode).toBe(200);
    expect(body.listing.status).toBe('published');
    expect(body.listing.publishedAt).not.toBeNull();
    expect(published).toMatchObject({ listingId: id, ownerId: host.id });

    const again = await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${id}/publish`,
      headers: authCookie(host),
    });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ code: 'listing_already_published' });

    await expect(
      h.db.kysely.updateTable('listings').set({ title: null }).where('id', '=', id).execute(),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('требует подтверждённый email для публикации', async () => {
    const { h, host } = await setup();
    const id = await createDraft(h, host);
    await fillRequired(h, host, id);
    await addPhotos(h, id, 3);

    await h.db.kysely
      .updateTable('users')
      .set({ email_verified_at: null })
      .where('id', '=', host.id)
      .execute();

    const response = await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${id}/publish`,
      headers: authCookie(host),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'email_not_verified' });
  });

  it('удаляет только черновик, архивирует только опубликованное', async () => {
    const { h, host } = await setup();
    const draftId = await createDraft(h, host);

    const archivedDraft = await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${draftId}/archive`,
      headers: authCookie(host),
    });
    expect(archivedDraft.statusCode).toBe(409);
    expect(archivedDraft.json()).toMatchObject({ code: 'listing_not_published' });

    const publishedId = await createDraft(h, host);
    await fillRequired(h, host, publishedId);
    await addPhotos(h, publishedId, 3);
    await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${publishedId}/publish`,
      headers: authCookie(host),
    });

    const removePublished = await h.app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${publishedId}`,
      headers: authCookie(host),
    });
    expect(removePublished.statusCode).toBe(409);
    expect(removePublished.json()).toMatchObject({ code: 'listing_not_draft' });

    const archived = await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${publishedId}/archive`,
      headers: authCookie(host),
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json()).toMatchObject({ listing: { status: 'archived' } });

    const removed = await h.app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${draftId}`,
      headers: authCookie(host),
    });
    expect(removed.statusCode).toBe(204);
  });

  it('не архивирует объявление с активной будущей бронью', async () => {
    const { h, host } = await setup();
    const id = await createDraft(h, host);
    await fillRequired(h, host, id);
    await addPhotos(h, id, 3);
    await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${id}/publish`,
      headers: authCookie(host),
    });
    await insertActiveBooking(h, id);

    const response = await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${id}/archive`,
      headers: authCookie(host),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'listing_has_active_bookings' });
  });

  it('закрывает эндпоинты без авторизации', async () => {
    const { h } = await setup();

    const responses = await Promise.all([
      h.app.inject({ method: 'GET', url: '/api/v1/me/listings' }),
      h.app.inject({ method: 'POST', url: '/api/v1/listings', payload: {} }),
      h.app.inject({
        method: 'PATCH',
        url: `/api/v1/listings/${crypto.randomUUID()}`,
        payload: {},
      }),
      h.app.inject({
        method: 'PUT',
        url: `/api/v1/listings/${crypto.randomUUID()}/amenities`,
        payload: { amenityIds: [] },
      }),
      h.app.inject({ method: 'POST', url: `/api/v1/listings/${crypto.randomUUID()}/publish` }),
      h.app.inject({ method: 'POST', url: `/api/v1/listings/${crypto.randomUUID()}/archive` }),
      h.app.inject({ method: 'DELETE', url: `/api/v1/listings/${crypto.randomUUID()}` }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });
});

// describeDatabase нужен и при пропуске: иначе переменная останется неиспользуемой.
void describe;
