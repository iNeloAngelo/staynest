import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import { Client } from 'pg';
import pino from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/platform/db/index';
import type { BookingStatus } from '../../src/platform/db/schema.generated';

const migrationsDir = fileURLToPath(new URL('../../../../db/migrations', import.meta.url));
const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));

function getTestDatabaseUrl(): string | undefined {
  if (!process.env.DATABASE_URL_TEST && existsSync(envFile)) process.loadEnvFile(envFile);
  return process.env.DATABASE_URL_TEST?.trim() || undefined;
}

const databaseUrl = getTestDatabaseUrl();

if (!databaseUrl && process.env.CI) {
  throw new Error('В CI обязателен DATABASE_URL_TEST: иначе тесты схемы молча пропускаются.');
}

const url = databaseUrl ?? '';
const describeDatabase = databaseUrl ? describe : describe.skip;

const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

type Ids = {
  hostId: string;
  guestId: string;
  listingId: string;
  secondListingId: string;
};

type BookingInput = {
  client: Client;
  listingId: string;
  guestId: string;
  range: [string, string];
  status?: BookingStatus;
};

function databaseName(urlValue: string): string {
  return decodeURIComponent(new URL(urlValue).pathname.replace(/^\//, ''));
}

function assertTestDatabase(urlValue: string): void {
  if (!databaseName(urlValue).endsWith('_test')) {
    throw new Error(
      `Отказ: ${databaseName(urlValue)} не похожа на тестовую базу (ожидается суффикс _test).`,
    );
  }
}

async function resetSchema(client: Client): Promise<void> {
  await client.query("SET lock_timeout = '5s'");
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO public');
}

async function insertListing(client: Client, ownerId: string, title: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO listings (owner_id, title, city, max_guests, bedrooms, beds, base_price_minor)
     VALUES ($1, $2, 'Москва', 4, 2, 3, 500000)
     RETURNING id`,
    [ownerId, title],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Не удалось создать объявление');
  return id;
}

async function seedBase(client: Client): Promise<Ids> {
  const host = await client.query<{ id: string }>(
    `INSERT INTO users (email, display_name) VALUES ('host@example.com', 'Хозяин') RETURNING id`,
  );
  const guest = await client.query<{ id: string }>(
    `INSERT INTO users (email, display_name) VALUES ('guest@example.com', 'Гость') RETURNING id`,
  );
  const hostId = host.rows[0]?.id ?? '';
  const guestId = guest.rows[0]?.id ?? '';
  if (!hostId || !guestId) throw new Error('Не удалось создать пользователей');

  return {
    hostId,
    guestId,
    listingId: await insertListing(client, hostId, 'Тестовый дом'),
    secondListingId: await insertListing(client, hostId, 'Второй дом'),
  };
}

async function insertBooking({
  client,
  listingId,
  guestId,
  range,
  status = 'pending',
}: BookingInput): Promise<void> {
  await client.query(
    `INSERT INTO bookings (listing_id, guest_id, stay_range, guests_count, status, total_minor, currency, price_breakdown)
     VALUES ($1, $2, daterange($3::date, $4::date, '[)'), 2, $5::booking_status, 100000, 'RUB', '{"nights": 2}')`,
    [listingId, guestId, range[0], range[1], status],
  );
}

async function insertBlock(
  client: Client,
  listingId: string,
  range: [string, string],
): Promise<void> {
  await client.query(
    `INSERT INTO listing_blocks (listing_id, block_range, reason)
     VALUES ($1, daterange($2::date, $3::date, '[)'), 'Ремонт')`,
    [listingId, range[0], range[1]],
  );
}

describeDatabase('схема БД: защита от пересечения дат', () => {
  let client: Client;
  let ids: Ids;

  beforeAll(async () => {
    if (!url) return;
    assertTestDatabase(url);
    client = new Client({ connectionString: url });
    await client.connect();
    await resetSchema(client);
    await runner({
      databaseUrl: url,
      dir: migrationsDir,
      direction: 'up',
      count: Infinity,
      migrationsTable: 'pgmigrations',
      logger: silentLogger,
    });
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(async () => {
    await client.query(
      'TRUNCATE users, listings, bookings, listing_blocks RESTART IDENTITY CASCADE',
    );
    ids = await seedBase(client);
  });

  it('отклоняет пересечение активных броней', async () => {
    await insertBooking({
      client,
      listingId: ids.listingId,
      guestId: ids.guestId,
      range: ['2026-07-10', '2026-07-12'],
    });

    await expect(
      insertBooking({
        client,
        listingId: ids.listingId,
        guestId: ids.guestId,
        range: ['2026-07-11', '2026-07-13'],
      }),
    ).rejects.toMatchObject({ code: '23P01' });
  });

  it('отклоняет пересечение pending и confirmed', async () => {
    await insertBooking({
      client,
      listingId: ids.listingId,
      guestId: ids.guestId,
      range: ['2026-07-10', '2026-07-12'],
    });

    await expect(
      insertBooking({
        client,
        listingId: ids.listingId,
        guestId: ids.guestId,
        range: ['2026-07-12', '2026-07-14'],
        status: 'confirmed',
      }),
    ).resolves.toBeUndefined();

    await expect(
      insertBooking({
        client,
        listingId: ids.listingId,
        guestId: ids.guestId,
        range: ['2026-07-09', '2026-07-11'],
        status: 'confirmed',
      }),
    ).rejects.toMatchObject({ code: '23P01' });
  });

  it('пропускает смежные даты [10,12) и [12,14)', async () => {
    await insertBooking({
      client,
      listingId: ids.listingId,
      guestId: ids.guestId,
      range: ['2026-07-10', '2026-07-12'],
    });

    await expect(
      insertBooking({
        client,
        listingId: ids.listingId,
        guestId: ids.guestId,
        range: ['2026-07-12', '2026-07-14'],
      }),
    ).resolves.toBeUndefined();
  });

  it.each(['declined', 'cancelled_by_guest', 'cancelled_by_host', 'expired', 'completed'] as const)(
    'не считает бронью в статусе %s занятой',
    async (status) => {
      await insertBooking({
        client,
        listingId: ids.listingId,
        guestId: ids.guestId,
        range: ['2026-07-10', '2026-07-12'],
        status,
      });

      await expect(
        insertBooking({
          client,
          listingId: ids.listingId,
          guestId: ids.guestId,
          range: ['2026-07-11', '2026-07-13'],
        }),
      ).resolves.toBeUndefined();
    },
  );

  it('не конфликтует с бронью другого объявления', async () => {
    await insertBooking({
      client,
      listingId: ids.listingId,
      guestId: ids.guestId,
      range: ['2026-07-10', '2026-07-12'],
    });

    await expect(
      insertBooking({
        client,
        listingId: ids.secondListingId,
        guestId: ids.guestId,
        range: ['2026-07-10', '2026-07-12'],
      }),
    ).resolves.toBeUndefined();
  });

  it('сохраняет модель [): день выезда свободен для следующего заезда', async () => {
    await insertBooking({
      client,
      listingId: ids.listingId,
      guestId: ids.guestId,
      range: ['2026-07-10', '2026-07-12'],
    });

    const result = await client.query<{ check_in: string; check_out: string; nights: number }>(
      `SELECT check_in::text, check_out::text, nights FROM bookings LIMIT 1`,
    );

    expect(result.rows[0]).toEqual({ check_in: '2026-07-10', check_out: '2026-07-12', nights: 2 });
  });

  it('возвращает даты проживания строками через Kysely', async () => {
    if (!url) return;
    await insertBooking({
      client,
      listingId: ids.listingId,
      guestId: ids.guestId,
      range: ['2026-07-10', '2026-07-12'],
    });

    const db = createDb(url, pino({ level: 'silent' }), 5000);
    try {
      const row = await db.kysely
        .selectFrom('bookings')
        .select(['check_in', 'check_out', 'nights'])
        .executeTakeFirstOrThrow();

      expect(row).toEqual({ check_in: '2026-07-10', check_out: '2026-07-12', nights: 2 });
    } finally {
      await db.close();
    }
  });

  it('отклоняет пересечение блокировок хозяина', async () => {
    await insertBlock(client, ids.listingId, ['2026-08-01', '2026-08-05']);

    await expect(
      insertBlock(client, ids.listingId, ['2026-08-04', '2026-08-07']),
    ).rejects.toMatchObject({ code: '23P01' });
  });

  it('пропускает смежные блокировки', async () => {
    await insertBlock(client, ids.listingId, ['2026-08-01', '2026-08-05']);

    await expect(
      insertBlock(client, ids.listingId, ['2026-08-05', '2026-08-07']),
    ).resolves.toBeUndefined();
  });

  it('не конфликтует с блокировкой другого объявления', async () => {
    await insertBlock(client, ids.listingId, ['2026-08-01', '2026-08-05']);

    await expect(
      insertBlock(client, ids.secondListingId, ['2026-08-01', '2026-08-05']),
    ).resolves.toBeUndefined();
  });

  it('отклоняет бесконечные диапазоны брони и блокировки', async () => {
    await expect(
      client.query(
        `INSERT INTO bookings (listing_id, guest_id, stay_range, guests_count, total_minor, currency, price_breakdown)
         VALUES ($1, $2, daterange(NULL, NULL, '[)'), 2, 100000, 'RUB', '{}')`,
        [ids.listingId, ids.guestId],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      client.query(
        `INSERT INTO listing_blocks (listing_id, block_range)
         VALUES ($1, daterange(NULL, NULL, '[)'))`,
        [ids.listingId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('канонизирует включительные границы в [) и не теряет ночи', async () => {
    const booking = await client.query<{
      range: string;
      check_out: string;
      nights: number;
    }>(
      `INSERT INTO bookings (listing_id, guest_id, stay_range, guests_count, total_minor, currency, price_breakdown)
       VALUES ($1, $2, daterange('2026-07-10', '2026-07-12', '[]'), 2, 100000, 'RUB', '{}')
       RETURNING stay_range::text AS range, check_out::text, nights`,
      [ids.listingId, ids.guestId],
    );

    expect(booking.rows[0]).toEqual({
      range: '[2026-07-10,2026-07-13)',
      check_out: '2026-07-13',
      nights: 3,
    });

    const block = await client.query<{ range: string }>(
      `INSERT INTO listing_blocks (listing_id, block_range)
       VALUES ($1, daterange('2026-07-10', '2026-07-12', '(]'))
       RETURNING block_range::text AS range`,
      [ids.listingId],
    );
    expect(block.rows[0]?.range).toBe('[2026-07-11,2026-07-13)');
  });

  it('заполняет справочник удобств 14 записями', async () => {
    const result = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM amenities',
    );

    expect(result.rows[0]?.count).toBe('14');
  });

  it('подключается через Kysely-фабрику', async () => {
    if (!url) return;
    const db = createDb(url, pino({ level: 'silent' }), 5000);
    try {
      await expect(db.check()).resolves.toBe('up');
    } finally {
      await db.close();
    }
  });
});
