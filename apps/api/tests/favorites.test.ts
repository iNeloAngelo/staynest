import type { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { FavoriteIdsResponse, FavoritesResponse } from '@staynest/shared';
import { seedListing } from './support/booking-fixtures';
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

async function putFavorite(h: Harness, user: TestUser, listingId: string) {
  return h.app.inject({
    method: 'PUT',
    url: `/api/v1/me/favorites/${listingId}`,
    headers: authHeaders(user.cookie),
  });
}

async function deleteFavorite(h: Harness, user: TestUser, listingId: string) {
  return h.app.inject({
    method: 'DELETE',
    url: `/api/v1/me/favorites/${listingId}`,
    headers: authHeaders(user.cookie),
  });
}

async function favoriteIds(h: Harness, user: TestUser): Promise<string[]> {
  const response = await h.app.inject({
    method: 'GET',
    url: '/api/v1/me/favorites/ids',
    headers: authHeaders(user.cookie),
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as FavoriteIdsResponse).listingIds;
}

async function favoriteList(h: Harness, user: TestUser, query = ''): Promise<FavoritesResponse> {
  const response = await h.app.inject({
    method: 'GET',
    url: `/api/v1/me/favorites${query}`,
    headers: authHeaders(user.cookie),
  });
  expect(response.statusCode).toBe(200);
  return response.json() as FavoritesResponse;
}

describeDatabase('избранное', () => {
  let client: Client;
  let h: Harness;
  let guest: TestUser;
  let other: TestUser;
  let owner: TestUser;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    owner = await createUser(h, 'owner@example.ru', 'Хозяин');
    guest = await createUser(h, 'guest@example.ru', 'Гость');
    other = await createUser(h, 'other@example.ru', 'Другой гость');
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE favorites, bookings, listing_blocks, listings CASCADE');
  });

  it('добавляет дом и отдаёт его в списке и в id для сердечек', async () => {
    const listingId = await seedListing(h, owner.id);

    const added = await putFavorite(h, guest, listingId);
    expect(added.statusCode).toBe(200);
    expect(added.json()).toEqual({ listingId, favorite: true });

    expect(await favoriteIds(h, guest)).toEqual([listingId]);

    const list = await favoriteList(h, guest);
    expect(list.listings).toHaveLength(1);
    expect(list.listings[0]).toMatchObject({
      id: listingId,
      title: 'Дом у озера',
      city: 'Суздаль',
    });
    expect(list.listings[0]).not.toHaveProperty('addressLine');
    expect(list.nextCursor).toBeNull();
  });

  it('повторное добавление идемпотентно, удаление тоже', async () => {
    const listingId = await seedListing(h, owner.id);

    expect((await putFavorite(h, guest, listingId)).statusCode).toBe(200);
    expect((await putFavorite(h, guest, listingId)).statusCode).toBe(200);
    expect(await favoriteIds(h, guest)).toEqual([listingId]);

    expect((await deleteFavorite(h, guest, listingId)).statusCode).toBe(200);
    expect((await deleteFavorite(h, guest, listingId)).statusCode).toBe(200);
    expect(await favoriteIds(h, guest)).toEqual([]);
    expect((await favoriteList(h, guest)).listings).toHaveLength(0);
  });

  it('чужой черновик неотличим от несуществующего дома', async () => {
    const draftId = await seedListing(h, owner.id, { status: 'draft' });

    const response = await putFavorite(h, guest, draftId);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'listing_not_found' });
  });

  it('избранное одного пользователя не видно и не удаляется другим', async () => {
    const listingId = await seedListing(h, owner.id);
    await putFavorite(h, guest, listingId);

    expect(await favoriteIds(h, other)).toEqual([]);
    expect((await favoriteList(h, other)).listings).toHaveLength(0);

    expect((await deleteFavorite(h, other, listingId)).statusCode).toBe(200);
    expect(await favoriteIds(h, guest)).toEqual([listingId]);
  });

  it('архивный дом исчезает из сердечек и списка', async () => {
    const listingId = await seedListing(h, owner.id);
    await putFavorite(h, guest, listingId);

    await h.db.kysely
      .updateTable('listings')
      .set({ status: 'archived' })
      .where('id', '=', listingId)
      .execute();

    expect(await favoriteIds(h, guest)).toEqual([]);
    expect((await favoriteList(h, guest)).listings).toHaveLength(0);
  });

  it('архивные дома не занимают страницу и не оставляют пустой курсор', async () => {
    const archivedIds: string[] = [];
    for (let index = 0; index < 2; index += 1) {
      const id = await seedListing(h, owner.id);
      archivedIds.push(id);
      await putFavorite(h, guest, id);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const publishedId = await seedListing(h, owner.id);
    await putFavorite(h, guest, publishedId);

    await h.db.kysely
      .updateTable('listings')
      .set({ status: 'archived' })
      .where('id', 'in', archivedIds)
      .execute();

    const page = await favoriteList(h, guest, '?limit=2');
    expect(page.listings.map((listing) => listing.id)).toEqual([publishedId]);
    expect(page.nextCursor).toBeNull();
  });

  it('пагинация по курсору не теряет и не дублирует дома', async () => {
    const ids: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const id = await seedListing(h, owner.id);
      ids.push(id);
      await putFavorite(h, guest, id);
      // Разные микросекунды created_at, иначе порядок задаёт только listing_id.
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const first = await favoriteList(h, guest, '?limit=2');
    expect(first.listings.map((listing) => listing.id)).toEqual([ids[2], ids[1]]);
    expect(first.nextCursor).toBeTruthy();

    const second = await favoriteList(
      h,
      guest,
      `?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );
    expect(second.listings.map((listing) => listing.id)).toEqual([ids[0]]);
    expect(second.nextCursor).toBeNull();

    const seen = [...first.listings, ...second.listings].map((listing) => listing.id);
    expect(new Set(seen).size).toBe(3);
  });

  it('битый курсор даёт 400, а не 500', async () => {
    const response = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/favorites?cursor=not-a-cursor',
      headers: authHeaders(guest.cookie),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'invalid_cursor' });
  });

  it('без авторизации избранное недоступно', async () => {
    const response = await h.app.inject({ method: 'GET', url: '/api/v1/me/favorites' });
    expect(response.statusCode).toBe(401);
  });

  it('не принимает невалидный UUID объявления', async () => {
    const response = await h.app.inject({
      method: 'PUT',
      url: '/api/v1/me/favorites/not-a-uuid',
      headers: authHeaders(guest.cookie),
    });
    expect(response.statusCode).toBe(422);
  });
});
