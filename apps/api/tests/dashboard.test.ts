import type { Client } from 'pg';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { DashboardResponse } from '@staynest/shared';
import { addDays, todayInTimeZone } from '@staynest/shared';
import { insertBookingRow, seedListing } from './support/booking-fixtures';
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

function monthKey(today: string, offset: number): string {
  const [year, month] = today.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Последний день месяца `YYYY-MM` без перехода в следующую таймзону. */
function monthEnd(month: string): number {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, value ?? 1, 0)).getUTCDate();
}

async function dashboard(h: Harness, user: TestUser, months = 3): Promise<DashboardResponse> {
  const response = await h.app.inject({
    method: 'GET',
    url: `/api/v1/me/dashboard?months=${months}`,
    headers: authHeaders(user.cookie),
  });
  expect(response.statusCode).toBe(200);
  return response.json() as DashboardResponse;
}

describeDatabase('сводка хозяина', () => {
  let client: Client;
  let h: Harness;
  let host: TestUser;
  let otherHost: TestUser;
  let guest: TestUser;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    host = await createUser(h, 'host@example.ru', 'Хозяин');
    otherHost = await createUser(h, 'other-host@example.ru', 'Другой хозяин');
    guest = await createUser(h, 'guest@example.ru', 'Гость');
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE bookings, listing_blocks, listings CASCADE');
  });

  it('считает заявки, заезды, занятость и доход по фиксированным данным', async () => {
    const today = todayInTimeZone('Europe/Moscow');
    const currentMonth = monthKey(today, 0);
    const previousMonth = monthKey(today, -1);
    const beforePrevious = monthKey(today, -2);

    const main = await seedListing(h, host.id);

    // Одна активная заявка и одна просроченная: просроченная не должна попасть в счётчик.
    // Эти дома черновики: занятость считается только по опубликованным.
    const activePending = await seedListing(h, host.id, { status: 'draft' });
    await insertBookingRow(h, {
      listingId: activePending,
      guestId: guest.id,
      from: addDays(today, 20),
      to: addDays(today, 22),
      status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const expiredPending = await seedListing(h, host.id, { status: 'draft' });
    await insertBookingRow(h, {
      listingId: expiredPending,
      guestId: guest.id,
      from: addDays(today, 23),
      to: addDays(today, 25),
      status: 'pending',
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    // Подтверждённый заезд в окне 30 дней: 4 ночи.
    await insertBookingRow(h, {
      listingId: main,
      guestId: guest.id,
      from: addDays(today, 10),
      to: addDays(today, 14),
      status: 'confirmed',
      confirmedAt: new Date(),
    });

    // Блокировка на 2 ночи внутри окна.
    await h.db.kysely
      .insertInto('listing_blocks')
      .values({
        listing_id: main,
        block_range: sql<string>`daterange(${addDays(today, 25)}::date, ${addDays(today, 27)}::date, '[)')`,
        reason: 'Ремонт',
      })
      .execute();

    // Доход: две завершённые брони в прошлом месяце и одна позапрошлом.
    for (const checkIn of [`${previousMonth}-05`, `${previousMonth}-15`]) {
      await insertBookingRow(h, {
        listingId: main,
        guestId: guest.id,
        from: checkIn,
        to: addDays(checkIn, 2),
        status: 'completed',
        confirmedAt: new Date(`${previousMonth}-01T10:00:00Z`),
      });
    }
    await insertBookingRow(h, {
      listingId: main,
      guestId: guest.id,
      from: `${beforePrevious}-10`,
      to: `${beforePrevious}-12`,
      status: 'completed',
      confirmedAt: new Date(`${beforePrevious}-01T10:00:00Z`),
    });

    const data = await dashboard(h, host);

    expect(data.today).toBe(today);
    expect(data.pendingRequests).toBe(1);
    expect(data.upcomingCheckIns).toHaveLength(1);
    expect(data.upcomingCheckIns[0]).toMatchObject({
      listingId: main,
      listingTitle: 'Дом у озера',
      guestName: 'Гость',
      checkIn: addDays(today, 10),
      checkOut: addDays(today, 14),
      guestsCount: 2,
    });

    expect(data.occupancy).toEqual({
      from: today,
      to: addDays(today, 30),
      totalNights: 30,
      bookedNights: 4,
      blockedNights: 2,
      occupiedNights: 6,
      percent: 20,
    });

    expect(data.revenue.months.map((month) => month.month)).toEqual([
      beforePrevious,
      previousMonth,
      currentMonth,
    ]);
    expect(data.revenue.months[0]).toMatchObject({
      month: beforePrevious,
      bookings: 1,
      totalMinor: 100_000,
    });
    expect(data.revenue.months[1]).toMatchObject({
      month: previousMonth,
      bookings: 2,
      totalMinor: 200_000,
    });
    // В текущем месяце завершённых броней нет; подтверждённый будущий заезд
    // попадает сюда только если он не перешагнул границу месяца.
    expect(data.revenue.months[2]?.month).toBe(currentMonth);
    expect(data.revenue.currency).toBe('RUB');
  });

  it('не показывает данные чужого хозяина', async () => {
    const today = todayInTimeZone('Europe/Moscow');
    const foreignListing = await seedListing(h, otherHost.id);
    await insertBookingRow(h, {
      listingId: foreignListing,
      guestId: guest.id,
      from: addDays(today, 5),
      to: addDays(today, 7),
      status: 'confirmed',
      confirmedAt: new Date(),
    });

    const data = await dashboard(h, host);

    expect(data.pendingRequests).toBe(0);
    expect(data.upcomingCheckIns).toHaveLength(0);
    expect(data.occupancy).toMatchObject({ bookedNights: 0, blockedNights: 0, percent: 0 });
    expect(data.revenue.months.every((month) => month.totalMinor === 0)).toBe(true);
  });

  it('обрезает брони и блокировки границами окна 30 дней', async () => {
    const today = todayInTimeZone('Europe/Moscow');
    const boundaryHost = await createUser(h, 'boundary@example.ru', 'Границы');
    const home = await seedListing(h, boundaryHost.id);

    const startsAtEnd = await seedListing(h, boundaryHost.id, { status: 'draft' });
    const ongoing = await seedListing(h, boundaryHost.id, { status: 'draft' });
    const lateBlockHome = await seedListing(h, boundaryHost.id, { status: 'draft' });

    // Заезд начинается до конца окна и заканчивается после: 1 ночь.
    await insertBookingRow(h, {
      listingId: home,
      guestId: guest.id,
      from: addDays(today, 29),
      to: addDays(today, 32),
      status: 'confirmed',
      confirmedAt: new Date(),
    });
    // Заезд ровно на границе окна уже не попадает.
    await insertBookingRow(h, {
      listingId: startsAtEnd,
      guestId: guest.id,
      from: addDays(today, 30),
      to: addDays(today, 32),
      status: 'confirmed',
      confirmedAt: new Date(),
    });
    // Уже идущий заезд: 2 ночи в окне, но это не «ближайший заезд».
    await insertBookingRow(h, {
      listingId: ongoing,
      guestId: guest.id,
      from: addDays(today, -2),
      to: addDays(today, 2),
      status: 'confirmed',
      confirmedAt: new Date(),
    });
    // Блокировка внутри окна.
    await h.db.kysely
      .insertInto('listing_blocks')
      .values({
        listing_id: home,
        block_range: sql<string>`daterange(${addDays(today, 5)}::date, ${addDays(today, 8)}::date, '[)')`,
        reason: null,
      })
      .execute();
    // Блокировка после окна не считается.
    await h.db.kysely
      .insertInto('listing_blocks')
      .values({
        listing_id: lateBlockHome,
        block_range: sql<string>`daterange(${addDays(today, 33)}::date, ${addDays(today, 35)}::date, '[)')`,
        reason: null,
      })
      .execute();

    const data = await dashboard(h, boundaryHost);

    expect(data.occupancy).toEqual({
      from: today,
      to: addDays(today, 30),
      totalNights: 30,
      bookedNights: 3,
      blockedNights: 3,
      occupiedNights: 6,
      percent: 20,
    });
    expect(data.upcomingCheckIns.map((item) => item.checkIn)).toEqual([addDays(today, 29)]);
  });

  it('делит занятость на все опубликованные дома хозяина', async () => {
    const today = todayInTimeZone('Europe/Moscow');
    const multiHost = await createUser(h, 'multi@example.ru', 'Два дома');
    const first = await seedListing(h, multiHost.id);
    const second = await seedListing(h, multiHost.id);

    for (const listingId of [first, second]) {
      await insertBookingRow(h, {
        listingId,
        guestId: guest.id,
        from: addDays(today, 3),
        to: addDays(today, 5),
        status: 'confirmed',
        confirmedAt: new Date(),
      });
    }

    const data = await dashboard(h, multiHost);

    expect(data.occupancy).toMatchObject({
      totalNights: 60,
      bookedNights: 4,
      occupiedNights: 4,
      percent: 7,
    });
  });

  it('группирует доход по месяцу заезда, а не выезда', async () => {
    const today = todayInTimeZone('Europe/Moscow');
    const revenueHost = await createUser(h, 'revenue@example.ru', 'Доход');
    const home = await seedListing(h, revenueHost.id);
    const previousMonth = monthKey(today, -1);
    const beforePrevious = monthKey(today, -2);
    const lastDay = monthEnd(previousMonth);
    const crossingCheckIn = `${previousMonth}-${String(lastDay).padStart(2, '0')}`;

    // Заезд в последний день месяца, выезд уже в следующем: доход — в месяце заезда.
    await insertBookingRow(h, {
      listingId: home,
      guestId: guest.id,
      from: crossingCheckIn,
      to: addDays(crossingCheckIn, 2),
      status: 'completed',
      confirmedAt: new Date(`${previousMonth}-01T10:00:00Z`),
    });
    await insertBookingRow(h, {
      listingId: home,
      guestId: guest.id,
      from: `${beforePrevious}-10`,
      to: `${beforePrevious}-12`,
      status: 'completed',
      confirmedAt: new Date(`${beforePrevious}-01T10:00:00Z`),
    });

    const data = await dashboard(h, revenueHost);

    expect(data.revenue.months).toEqual([
      { month: beforePrevious, totalMinor: 100_000, bookings: 1 },
      { month: previousMonth, totalMinor: 100_000, bookings: 1 },
      { month: monthKey(today, 0), totalMinor: 0, bookings: 0 },
    ]);
  });

  it('возвращает не больше пяти ближайших заездов по возрастанию даты', async () => {
    const today = todayInTimeZone('Europe/Moscow');
    const manyHost = await createUser(h, 'many@example.ru', 'Много заездов');
    const home = await seedListing(h, manyHost.id);

    for (let index = 0; index < 6; index += 1) {
      await insertBookingRow(h, {
        listingId: home,
        guestId: guest.id,
        from: addDays(today, index),
        to: addDays(today, index + 1),
        status: 'confirmed',
        confirmedAt: new Date(),
      });
    }

    const data = await dashboard(h, manyHost);

    expect(data.upcomingCheckIns).toHaveLength(5);
    expect(data.upcomingCheckIns.map((item) => item.checkIn)).toEqual(
      Array.from({ length: 5 }, (_, index) => addDays(today, index)),
    );
  });

  it('возвращает ровно запрошенное число месяцев, включая переход через год', async () => {
    const today = todayInTimeZone('Europe/Moscow');
    const data = await dashboard(h, host, 12);

    expect(data.revenue.months).toHaveLength(12);
    expect(data.revenue.months[0]?.month).toBe(monthKey(today, -11));
    expect(data.revenue.months.at(-1)?.month).toBe(monthKey(today, 0));
  });

  it('ограничивает число месяцев и требует авторизацию', async () => {
    const tooMany = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/dashboard?months=99',
      headers: authHeaders(host.cookie),
    });
    expect(tooMany.statusCode).toBe(422);

    const anonymous = await h.app.inject({ method: 'GET', url: '/api/v1/me/dashboard' });
    expect(anonymous.statusCode).toBe(401);
  });
});
