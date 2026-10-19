import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { Client } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { addDays } from '@staynest/shared';
import { createBookingRequest, futureDay, seedListing } from './support/booking-fixtures';
import {
  ACCESS_COOKIE,
  TEST_PASSWORD,
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
} from './support/harness';
import type { Harness, TestUser } from './support/harness';

const url = databaseUrl ?? '';
const GUESTS = 50;
const RUNS = 20;

async function seedGuests(h: Harness): Promise<TestUser[]> {
  const passwordHash = await hash(TEST_PASSWORD);
  const users: TestUser[] = [];

  for (let index = 0; index < GUESTS; index += 1) {
    const email = `guest-${index}@example.ru`;
    const row = await h.db.kysely
      .insertInto('users')
      .values({
        email,
        password_hash: passwordHash,
        display_name: `Гость ${index}`,
        locale: 'ru',
        email_verified_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    users.push({ id: row.id, email, cookie: '' });
  }

  return users;
}

async function loginAll(h: Harness, users: TestUser[]): Promise<void> {
  for (const user of users) {
    const response = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: TEST_PASSWORD },
    });
    expect(response.statusCode).toBe(200);

    const access = response.cookies.find((cookie) => cookie.name === ACCESS_COOKIE)?.value;
    if (!access) throw new Error('Нет access cookie');
    user.cookie = `${ACCESS_COOKIE}=${access}`;
  }
}

describeDatabase('конкурентное бронирование', () => {
  let client: Client;
  let h: Harness;
  let host: TestUser;
  let guests: TestUser[];
  let listingId: string;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    host = await createUser(h, 'host@example.ru', 'Хозяин');
    guests = await seedGuests(h);
    await loginAll(h, guests);
    listingId = await seedListing(h, host.id);
  }, 120_000);

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  it(`50 одновременных заявок на одни даты: ровно 1 успех и 49 конфликтов, ${RUNS} запусков`, async () => {
    const checkIn = futureDay(30);
    const checkOut = addDays(checkIn, 4);
    const outcomes: string[] = [];

    for (let run = 0; run < RUNS; run += 1) {
      await client.query('TRUNCATE bookings RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE idempotency_keys');

      const responses = await Promise.all(
        guests.map((guest) =>
          createBookingRequest(h, guest, listingId, {
            checkIn,
            checkOut,
            key: randomUUID(),
          }),
        ),
      );
      const success = responses.filter((response) => response.statusCode === 201);
      const conflict = responses.filter((response) => response.statusCode === 409);
      const codes = conflict.map((response) => (response.json() as { code: string }).code);

      outcomes.push(`${success.length}/${conflict.length}`);

      expect(success, `run ${run}: успехов`).toHaveLength(1);
      expect(conflict, `run ${run}: конфликтов`).toHaveLength(GUESTS - 1);
      expect(codes.every((code) => code === 'booking_dates_unavailable')).toBe(true);

      const rows = await h.db.kysely
        .selectFrom('bookings')
        .select(({ fn }) => fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow();
      const events = await h.db.kysely
        .selectFrom('booking_events')
        .select(({ fn }) => fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow();
      const keys = await h.db.kysely
        .selectFrom('idempotency_keys')
        .select(({ fn }) => fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow();

      expect(Number(rows.count), `run ${run}: строки в БД`).toBe(1);
      expect(Number(events.count), `run ${run}: события`).toBe(1);
      expect(Number(keys.count), `run ${run}: ключи идемпотентности`).toBe(1);
    }

    expect(outcomes.every((value) => value === `1/${GUESTS - 1}`)).toBe(true);
  }, 240_000);
});
