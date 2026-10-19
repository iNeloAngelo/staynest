import type { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  BlockDto,
  CalendarResponse,
  HostCalendarResponse,
  PriceRuleDto,
  Quote,
} from '@staynest/shared';
import { addDays, isWeekendNight, todayInTimeZone } from '@staynest/shared';
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

type SeedOptions = {
  status?: 'draft' | 'published' | 'archived';
  weekendPriceMinor?: number | null;
  cleaningFeeMinor?: number;
  minNights?: number;
  maxNights?: number;
  maxGuests?: number;
};

async function seedListing(
  h: Harness,
  ownerId: string,
  options: SeedOptions = {},
): Promise<string> {
  const row = await h.db.kysely
    .insertInto('listings')
    .values({
      owner_id: ownerId,
      status: options.status ?? 'published',
      type: 'house',
      title: 'Дом у озера',
      description:
        'Тихий дом с террасой, камином и видом на сосновый лес. Подходит для семьи из четырёх человек.',
      country: 'RU',
      region: 'Владимирская область',
      city: 'Суздаль',
      address_line: 'Лесная улица, 12',
      max_guests: options.maxGuests ?? 4,
      bedrooms: 2,
      beds: 3,
      base_price_minor: 100_000,
      weekend_price_minor: options.weekendPriceMinor ?? null,
      cleaning_fee_minor: options.cleaningFeeMinor ?? 50_000,
      min_nights: options.minNights ?? 1,
      max_nights: options.maxNights ?? 30,
      published_at: options.status === 'draft' ? null : new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return row.id;
}

type BookingSeed = {
  listingId: string;
  guestId: string;
  from: string;
  to: string;
  status?: 'pending' | 'confirmed' | 'declined';
};

async function insertBooking(h: Harness, seed: BookingSeed): Promise<string> {
  const booking = await h.db.kysely
    .insertInto('bookings')
    .values({
      listing_id: seed.listingId,
      guest_id: seed.guestId,
      stay_range: `[${seed.from},${seed.to})`,
      guests_count: 2,
      total_minor: 100_000,
      currency: 'RUB',
      price_breakdown: { nights: [] },
      status: seed.status ?? 'confirmed',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return booking.id;
}

function futureFriday(): string {
  let date = addDays(todayInTimeZone('Europe/Moscow'), 14);
  while (!isWeekendNight(date)) date = addDays(date, 1);
  return date;
}

function quoteUrl(listingId: string, checkIn: string, checkOut: string, guests = 2): string {
  const params = new URLSearchParams({ checkIn, checkOut, guests: String(guests) });
  return `/api/v1/listings/${listingId}/quote?${params.toString()}`;
}

function calendarUrl(listingId: string, from: string, to: string): string {
  const params = new URLSearchParams({ from, to });
  return `/api/v1/listings/${listingId}/calendar?${params.toString()}`;
}

async function createRule(
  h: Harness,
  host: TestUser,
  listingId: string,
  payload: Record<string, unknown>,
): Promise<PriceRuleDto> {
  const response = await h.app.inject({
    method: 'POST',
    url: `/api/v1/listings/${listingId}/price-rules`,
    headers: authHeaders(host.cookie),
    payload,
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { priceRule: PriceRuleDto }).priceRule;
}

type BlockSeed = {
  host: TestUser;
  listingId: string;
  dateFrom: string;
  dateTo: string;
  reason?: string;
};

async function createBlock(h: Harness, seed: BlockSeed) {
  return h.app.inject({
    method: 'POST',
    url: `/api/v1/listings/${seed.listingId}/blocks`,
    headers: authHeaders(seed.host.cookie),
    payload: {
      dateFrom: seed.dateFrom,
      dateTo: seed.dateTo,
      ...(seed.reason === undefined ? {} : { reason: seed.reason }),
    },
  });
}

describeDatabase('pricing and availability API', () => {
  let client: Client;
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let otherHost: TestUser;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    host = await createUser(h, 'host@example.ru', 'Хозяин');
    guest = await createUser(h, 'guest@example.ru', 'Гость');
    otherHost = await createUser(h, 'other@example.ru', 'Другой');
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE listings RESTART IDENTITY CASCADE');
  });

  describe('quote', () => {
    it('считает базовую цену, выходные, сезонное правило и уборку', async () => {
      const listingId = await seedListing(h, host.id, { weekendPriceMinor: 150_000 });
      const friday = futureFriday();
      const saturday = addDays(friday, 1);
      await createRule(h, host, listingId, {
        name: 'Июльская суббота',
        dateFrom: saturday,
        dateTo: saturday,
        nightlyPriceMinor: 400_000,
        priority: 5,
      });

      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, friday, addDays(friday, 2)),
      });
      const { quote } = response.json() as { quote: Quote };

      expect(response.statusCode).toBe(200);
      expect(quote.nights).toBe(2);
      expect(quote.nightly[0]).toMatchObject({
        date: friday,
        source: 'weekend',
        priceMinor: 150_000,
      });
      expect(quote.nightly[1]).toMatchObject({
        date: saturday,
        source: 'seasonal',
        priceMinor: 400_000,
      });
      expect(quote.nightlyTotalMinor).toBe(550_000);
      expect(quote.cleaningFeeMinor).toBe(50_000);
      expect(quote.serviceFeeMinor).toBe(0);
      expect(quote.totalMinor).toBe(600_000);
      expect(quote.groups).toHaveLength(2);
    });

    it('принимает snake_case-параметры из ТЗ', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      const response = await h.app.inject({
        method: 'GET',
        url: `/api/v1/listings/${listingId}/quote?check_in=${friday}&check_out=${addDays(friday, 1)}&guests=2`,
      });

      expect(response.statusCode).toBe(200);
    });

    it('требует минимальный срок сезонного правила', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      await createRule(h, host, listingId, {
        name: 'Высокий сезон',
        dateFrom: friday,
        dateTo: addDays(friday, 30),
        nightlyPriceMinor: 200_000,
        minNights: 3,
      });

      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, friday, addDays(friday, 2)),
      });
      const problem = response.json() as { code: string; errors: Array<{ minNights: number }> };

      expect(response.statusCode).toBe(422);
      expect(problem.code).toBe('min_nights_not_met');
      expect(problem.errors[0]?.minNights).toBe(3);
    });

    it('отклоняет срок больше максимального', async () => {
      const listingId = await seedListing(h, host.id, { maxNights: 5 });
      const friday = futureFriday();
      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, friday, addDays(friday, 6)),
      });

      expect(response.statusCode).toBe(422);
      expect((response.json() as { code: string }).code).toBe('max_nights_exceeded');
    });

    it('отклоняет гостей больше вместимости', async () => {
      const listingId = await seedListing(h, host.id, { maxGuests: 4 });
      const friday = futureFriday();
      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, friday, addDays(friday, 1), 5),
      });

      expect(response.statusCode).toBe(422);
      expect((response.json() as { code: string }).code).toBe('guests_exceed_capacity');
    });

    it('отклоняет прошедшую дату заезда', async () => {
      const listingId = await seedListing(h, host.id);
      const yesterday = addDays(todayInTimeZone('Europe/Moscow'), -1);
      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, yesterday, addDays(yesterday, 2)),
      });

      expect(response.statusCode).toBe(422);
      expect((response.json() as { code: string }).code).toBe('stay_in_past');
    });

    it('отвечает 409 на пересечение с активной бронью', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      await insertBooking(h, {
        listingId,
        guestId: guest.id,
        from: friday,
        to: addDays(friday, 2),
      });

      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, addDays(friday, 1), addDays(friday, 3)),
      });

      expect(response.statusCode).toBe(409);
      expect((response.json() as { code: string }).code).toBe('dates_unavailable');
    });

    it('разрешает заезд в день выезда предыдущего гостя', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      await insertBooking(h, {
        listingId,
        guestId: guest.id,
        from: friday,
        to: addDays(friday, 2),
      });

      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, addDays(friday, 2), addDays(friday, 4)),
      });

      expect(response.statusCode).toBe(200);
    });

    it('не учитывает отклонённую бронь', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      await insertBooking(h, {
        listingId,
        guestId: guest.id,
        from: friday,
        to: addDays(friday, 2),
        status: 'declined',
      });

      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, friday, addDays(friday, 2)),
      });

      expect(response.statusCode).toBe(200);
    });

    it('учитывает ожидающую заявку как занятые даты', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      await insertBooking(h, {
        listingId,
        guestId: guest.id,
        from: friday,
        to: addDays(friday, 2),
        status: 'pending',
      });

      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, friday, addDays(friday, 2)),
      });

      expect(response.statusCode).toBe(409);
      expect((response.json() as { code: string }).code).toBe('dates_unavailable');
    });

    it('отвечает 409 на пересечение с блокировкой хозяина', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      const block = await createBlock(h, {
        host,
        listingId,
        dateFrom: friday,
        dateTo: addDays(friday, 1),
      });
      expect(block.statusCode).toBe(201);

      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, friday, addDays(friday, 2)),
      });

      expect(response.statusCode).toBe(409);
      expect((response.json() as { code: string }).code).toBe('dates_unavailable');
    });

    it('не принимает quote длиннее года', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();

      const response = await h.app.inject({
        method: 'GET',
        url: quoteUrl(listingId, friday, addDays(friday, 366)),
      });

      expect(response.statusCode).toBe(422);
    });

    it('не раскрывает черновик и архив', async () => {
      const draft = await seedListing(h, host.id, { status: 'draft' });
      const archived = await seedListing(h, host.id, { status: 'archived' });
      const friday = futureFriday();

      for (const id of [draft, archived]) {
        const response = await h.app.inject({
          method: 'GET',
          url: quoteUrl(id, friday, addDays(friday, 1)),
        });
        expect(response.statusCode).toBe(404);
        expect((response.json() as { code: string }).code).toBe('listing_not_found');
      }
    });
  });

  describe('calendar', () => {
    it('отдаёт занятые и заблокированные ночи без деталей брони', async () => {
      const listingId = await seedListing(h, host.id, { minNights: 2 });
      const friday = futureFriday();
      await insertBooking(h, {
        listingId,
        guestId: guest.id,
        from: friday,
        to: addDays(friday, 2),
      });
      await insertBooking(h, {
        listingId,
        guestId: guest.id,
        from: addDays(friday, 3),
        to: addDays(friday, 5),
        status: 'declined',
      });
      await createBlock(h, {
        host,
        listingId,
        dateFrom: addDays(friday, 6),
        dateTo: addDays(friday, 7),
      });

      const response = await h.app.inject({
        method: 'GET',
        url: calendarUrl(listingId, friday, addDays(friday, 8)),
      });
      const calendar = response.json() as CalendarResponse;

      expect(response.statusCode).toBe(200);
      expect(calendar.today).toBe(todayInTimeZone('Europe/Moscow'));
      expect(calendar.minNights).toBe(2);
      expect(calendar.unavailable).toEqual([
        { date: friday, kind: 'booked' },
        { date: addDays(friday, 1), kind: 'booked' },
        { date: addDays(friday, 6), kind: 'blocked' },
        { date: addDays(friday, 7), kind: 'blocked' },
      ]);
      expect(JSON.stringify(calendar)).not.toContain(guest.id);
      expect(calendar).not.toHaveProperty('bookings');
    });

    it('отдаёт 404 для черновика', async () => {
      const listingId = await seedListing(h, host.id, { status: 'draft' });
      const friday = futureFriday();
      const response = await h.app.inject({
        method: 'GET',
        url: calendarUrl(listingId, friday, addDays(friday, 2)),
      });

      expect(response.statusCode).toBe(404);
    });

    it('проверяет диапазон дат', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();

      const reversed = await h.app.inject({
        method: 'GET',
        url: calendarUrl(listingId, addDays(friday, 2), friday),
      });
      const tooLong = await h.app.inject({
        method: 'GET',
        url: calendarUrl(listingId, friday, addDays(friday, 401)),
      });

      expect(reversed.statusCode).toBe(422);
      expect(tooLong.statusCode).toBe(422);
    });

    it('показывает хозяину брони и блокировки, но не чужие объявления', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      const bookingId = await insertBooking(h, {
        listingId,
        guestId: guest.id,
        from: friday,
        to: addDays(friday, 2),
      });
      await createBlock(h, {
        host,
        listingId,
        dateFrom: addDays(friday, 5),
        dateTo: addDays(friday, 6),
        reason: 'Ремонт',
      });

      const response = await h.app.inject({
        method: 'GET',
        url: `/api/v1/listings/${listingId}/calendar/host?from=${friday}&to=${addDays(friday, 10)}`,
        headers: authHeaders(host.cookie),
      });
      const calendar = response.json() as HostCalendarResponse;

      expect(response.statusCode).toBe(200);
      expect(calendar.bookings).toEqual([
        {
          id: bookingId,
          status: 'confirmed',
          checkIn: friday,
          checkOut: addDays(friday, 2),
          guestName: 'Гость',
        },
      ]);
      expect(calendar.blocks).toHaveLength(1);
      expect(calendar.blocks[0]).toMatchObject({
        dateFrom: addDays(friday, 5),
        dateTo: addDays(friday, 6),
        reason: 'Ремонт',
      });

      const stranger = await h.app.inject({
        method: 'GET',
        url: `/api/v1/listings/${listingId}/calendar/host?from=${friday}&to=${addDays(friday, 10)}`,
        headers: authHeaders(otherHost.cookie),
      });
      expect(stranger.statusCode).toBe(404);
    });
  });

  describe('price rules', () => {
    it('создаёт, перечисляет, правит и удаляет правило', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();

      const created = await createRule(h, host, listingId, {
        name: 'Сентябрь',
        dateFrom: friday,
        dateTo: addDays(friday, 30),
        nightlyPriceMinor: 250_000,
        minNights: 2,
        priority: 3,
      });
      expect(created).toMatchObject({ name: 'Сентябрь', nightlyPriceMinor: 250_000, priority: 3 });

      const list = await h.app.inject({
        method: 'GET',
        url: `/api/v1/listings/${listingId}/price-rules`,
        headers: authHeaders(host.cookie),
      });
      expect((list.json() as { priceRules: PriceRuleDto[] }).priceRules).toHaveLength(1);

      const patched = await h.app.inject({
        method: 'PATCH',
        url: `/api/v1/listings/${listingId}/price-rules/${created.id}`,
        headers: authHeaders(host.cookie),
        payload: { nightlyPriceMinor: 275_000 },
      });
      expect(patched.statusCode).toBe(200);
      expect((patched.json() as { priceRule: PriceRuleDto }).priceRule.nightlyPriceMinor).toBe(
        275_000,
      );

      const removed = await h.app.inject({
        method: 'DELETE',
        url: `/api/v1/listings/${listingId}/price-rules/${created.id}`,
        headers: authHeaders(host.cookie),
      });
      expect(removed.statusCode).toBe(204);

      const missing = await h.app.inject({
        method: 'DELETE',
        url: `/api/v1/listings/${listingId}/price-rules/${created.id}`,
        headers: authHeaders(host.cookie),
      });
      expect(missing.statusCode).toBe(404);
    });

    it('проверяет период и владение', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();

      const badPeriod = await h.app.inject({
        method: 'POST',
        url: `/api/v1/listings/${listingId}/price-rules`,
        headers: authHeaders(host.cookie),
        payload: {
          name: 'Кривой период',
          dateFrom: addDays(friday, 5),
          dateTo: friday,
          nightlyPriceMinor: 200_000,
        },
      });
      expect(badPeriod.statusCode).toBe(422);

      const tooLongMinNights = await h.app.inject({
        method: 'POST',
        url: `/api/v1/listings/${listingId}/price-rules`,
        headers: authHeaders(host.cookie),
        payload: {
          name: 'Невозможный срок',
          dateFrom: friday,
          dateTo: addDays(friday, 10),
          nightlyPriceMinor: 200_000,
          minNights: 31,
        },
      });
      expect(tooLongMinNights.statusCode).toBe(422);
      expect((tooLongMinNights.json() as { errors: Array<{ code: string }> }).errors[0]?.code).toBe(
        'min_nights_exceeds_listing',
      );

      const foreign = await h.app.inject({
        method: 'GET',
        url: `/api/v1/listings/${listingId}/price-rules`,
        headers: authHeaders(otherHost.cookie),
      });
      expect(foreign.statusCode).toBe(404);

      const anonymous = await h.app.inject({
        method: 'GET',
        url: `/api/v1/listings/${listingId}/price-rules`,
      });
      expect(anonymous.statusCode).toBe(401);
    });
  });

  describe('blocks', () => {
    it('создаёт блокировку включительно, показывает её в календаре и снимает', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      const lastNight = addDays(friday, 2);

      const created = await createBlock(h, {
        host,
        listingId,
        dateFrom: friday,
        dateTo: lastNight,
        reason: 'Ремонт',
      });
      const block = (created.json() as { block: BlockDto }).block;

      expect(created.statusCode).toBe(201);
      expect(block).toMatchObject({ dateFrom: friday, dateTo: lastNight, reason: 'Ремонт' });

      const calendar = await h.app.inject({
        method: 'GET',
        url: calendarUrl(listingId, friday, addDays(friday, 5)),
      });
      const unavailable = (calendar.json() as CalendarResponse).unavailable;
      expect(unavailable.map((night) => night.date)).toEqual([
        friday,
        addDays(friday, 1),
        lastNight,
      ]);

      const list = await h.app.inject({
        method: 'GET',
        url: `/api/v1/listings/${listingId}/blocks`,
        headers: authHeaders(host.cookie),
      });
      expect((list.json() as { blocks: BlockDto[] }).blocks).toHaveLength(1);

      const removed = await h.app.inject({
        method: 'DELETE',
        url: `/api/v1/listings/${listingId}/blocks/${block.id}`,
        headers: authHeaders(host.cookie),
      });
      expect(removed.statusCode).toBe(204);

      const removedAgain = await h.app.inject({
        method: 'DELETE',
        url: `/api/v1/listings/${listingId}/blocks/${block.id}`,
        headers: authHeaders(host.cookie),
      });
      expect(removedAgain.statusCode).toBe(404);
    });

    it('не даёт заблокировать занятые даты и пересечь блокировки', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      await insertBooking(h, {
        listingId,
        guestId: guest.id,
        from: friday,
        to: addDays(friday, 2),
      });

      const overBooking = await createBlock(h, {
        host,
        listingId,
        dateFrom: addDays(friday, 1),
        dateTo: addDays(friday, 3),
      });
      expect(overBooking.statusCode).toBe(409);
      expect((overBooking.json() as { code: string }).code).toBe('block_overlaps_booking');

      const first = await createBlock(h, {
        host,
        listingId,
        dateFrom: addDays(friday, 5),
        dateTo: addDays(friday, 6),
      });
      expect(first.statusCode).toBe(201);

      const overlap = await createBlock(h, {
        host,
        listingId,
        dateFrom: addDays(friday, 6),
        dateTo: addDays(friday, 7),
      });
      expect(overlap.statusCode).toBe(409);
      expect((overlap.json() as { code: string }).code).toBe('block_overlaps');
    });

    it('не даёт заблокировать прошедшие даты', async () => {
      const listingId = await seedListing(h, host.id);
      const yesterday = addDays(todayInTimeZone('Europe/Moscow'), -1);
      const response = await createBlock(h, {
        host,
        listingId,
        dateFrom: yesterday,
        dateTo: yesterday,
      });

      expect(response.statusCode).toBe(422);
      expect((response.json() as { code: string }).code).toBe('block_in_past');
    });

    it('ограничивает длину блокировки и причины', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();

      const tooLong = await createBlock(h, {
        host,
        listingId,
        dateFrom: friday,
        dateTo: addDays(friday, 366),
      });
      expect(tooLong.statusCode).toBe(422);

      const longReason = await createBlock(h, {
        host,
        listingId,
        dateFrom: friday,
        dateTo: friday,
        reason: 'р'.repeat(201),
      });
      expect(longReason.statusCode).toBe(422);
    });

    it('скрывает чужие блокировки', async () => {
      const listingId = await seedListing(h, host.id);
      const friday = futureFriday();
      const response = await createBlock(h, {
        host: otherHost,
        listingId,
        dateFrom: friday,
        dateTo: friday,
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
