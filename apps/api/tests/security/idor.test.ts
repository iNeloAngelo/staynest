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
