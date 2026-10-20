import type { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type {
  NotificationsResponse,
  PushSubscriptionResponse,
  NotificationDto,
} from '@staynest/shared';
import { addDays } from '@staynest/shared';
import { createBookingJobs } from '../src/modules/bookings/index';
import type { PushSender } from '../src/modules/notifications/index';
import {
  createBookingRequest,
  futureDay,
  insertBookingRow,
  seedListing,
} from './support/booking-fixtures';
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

type SentPush = { endpoint: string; title: string; body: string; url: string; tag: string };

function fakePush(sent: SentPush[]): PushSender {
  return {
    enabled: true,
    publicKey: 'test-public-key',
    async send(target, message) {
      if (target.endpoint.includes('gone')) {
        return { ok: false, gone: true, code: 'push_410', statusCode: 410 };
      }

      sent.push({ endpoint: target.endpoint, ...message });
      return { ok: true };
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForNotificationCount(h: Harness, userId: string, count: number): Promise<void> {
  await waitFor(async () => {
    const row = await h.db.kysely
      .selectFrom('notifications')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();

    return Number(row.count) >= count;
  }, `Уведомление для ${userId} не появилось за 2 секунды`);
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  message: string,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await predicate()) return;
    await sleep(20);
  }

  throw new Error(message);
}

async function listNotifications(h: Harness, user: TestUser): Promise<NotificationsResponse> {
  const response = await h.app.inject({
    method: 'GET',
    url: '/api/v1/me/notifications?limit=50',
    headers: authHeaders(user.cookie),
  });
  expect(response.statusCode).toBe(200);
  return response.json() as NotificationsResponse;
}

describeDatabase('уведомления и web push', () => {
  let client: Client;
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let stranger: TestUser;
  const sent: SentPush[] = [];

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness(
      {
        push: {
          enabled: true,
          publicKey: 'test-public-key',
          privateKey: 'test-private-key',
          subject: 'mailto:test@staynest.local',
        },
      },
      undefined,
      fakePush(sent),
    );
    host = await createUser(h, 'host@example.ru', 'Хозяин');
    guest = await createUser(h, 'guest@example.ru', 'Гость');
    stranger = await createUser(h, 'stranger@example.ru', 'Посторонний');
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  beforeEach(async () => {
    sent.length = 0;
    await client.query(
      'TRUNCATE notifications, push_subscriptions, listings RESTART IDENTITY CASCADE',
    );
    await client.query('TRUNCATE idempotency_keys');
  });

  async function newBooking(checkIn = futureDay(14)) {
    const listingId = await seedListing(h, host.id);
    const response = await createBookingRequest(h, guest, listingId, {
      checkIn,
      checkOut: addDays(checkIn, 2),
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { booking: { id: string } }).booking.id;
  }

  it('создаёт заявку хозяину, а не гостю, и отдаёт семантический payload', async () => {
    const bookingId = await newBooking();
    await waitForNotificationCount(h, host.id, 1);

    const hostList = await listNotifications(h, host);
    const guestList = await listNotifications(h, guest);

    expect(hostList.unreadCount).toBe(1);
    expect(hostList.notifications[0]).toMatchObject({
      type: 'booking_requested',
      readAt: null,
      payload: {
        bookingId,
        listingTitle: 'Дом у озера',
        guestName: 'Гость',
        checkIn: futureDay(14),
        checkOut: addDays(futureDay(14), 2),
        currency: 'RUB',
      },
    });
    expect(guestList.notifications).toEqual([]);
    expect(guestList.unreadCount).toBe(0);
  });

  it('помечает прочитанным только своё уведомление', async () => {
    await newBooking();
    await waitForNotificationCount(h, host.id, 1);
    const [notification] = (await listNotifications(h, host)).notifications;
    expect(notification).toBeDefined();

    const foreign = await h.app.inject({
      method: 'POST',
      url: '/api/v1/me/notifications/read',
      headers: authHeaders(stranger.cookie),
      payload: { ids: [notification?.id] },
    });
    expect(foreign.statusCode).toBe(200);
    expect(foreign.json()).toEqual({ updated: 0, unreadCount: 0 });
    expect((await listNotifications(h, host)).unreadCount).toBe(1);

    const own = await h.app.inject({
      method: 'POST',
      url: '/api/v1/me/notifications/read',
      headers: authHeaders(host.cookie),
      payload: { ids: [notification?.id] },
    });
    expect(own.json()).toEqual({ updated: 1, unreadCount: 0 });
    expect((await listNotifications(h, host)).notifications[0]?.readAt).not.toBeNull();
  });

  it('отдаёт устойчивую курсорную пагинацию', async () => {
    for (let index = 0; index < 3; index += 1) {
      await h.db.kysely
        .insertInto('notifications')
        .values({
          user_id: host.id,
          type: 'booking_requested',
          payload: {
            bookingId: '00000000-0000-4000-8000-000000000001',
            listingId: '00000000-0000-4000-8000-000000000002',
            listingTitle: 'Дом',
            checkIn: futureDay(10),
            checkOut: futureDay(12),
            guestName: 'Гость',
            totalMinor: 100_000,
            currency: 'RUB',
          },
        })
        .execute();
    }

    const first = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/notifications?limit=2',
      headers: authHeaders(host.cookie),
    });
    const firstPage = first.json() as NotificationsResponse;
    expect(firstPage.notifications).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const second = await h.app.inject({
      method: 'GET',
      url: `/api/v1/me/notifications?limit=2&cursor=${firstPage.nextCursor}`,
      headers: authHeaders(host.cookie),
    });
    const secondPage = second.json() as NotificationsResponse;
    expect(secondPage.notifications).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();

    const ids = [...firstPage.notifications, ...secondPage.notifications].map((item) => item.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('уведомляет гостя о подтверждении и отклонении', async () => {
    const confirmedId = await newBooking(futureDay(20));
    await waitForNotificationCount(h, host.id, 1);

    const confirmed = await h.app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${confirmedId}/confirm`,
      headers: authHeaders(host.cookie),
    });
    expect(confirmed.statusCode).toBe(200);
    await waitForNotificationCount(h, guest.id, 1);

    const guestList = await listNotifications(h, guest);
    expect(guestList.notifications[0]?.type).toBe('booking_confirmed');

    const declinedId = await newBooking(futureDay(24));
    await waitForNotificationCount(h, host.id, 2);
    const declined = await h.app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${declinedId}/decline`,
      headers: authHeaders(host.cookie),
      payload: { comment: 'Даты заняты' },
    });
    expect(declined.statusCode).toBe(200);
    await waitForNotificationCount(h, guest.id, 2);

    const types = (await listNotifications(h, guest)).notifications.map(
      (item: NotificationDto) => item.type,
    );
    expect(types).toContain('booking_declined');
  });

  it('уведомляет вторую сторону об отмене и не дублирует повтор', async () => {
    const bookingId = await newBooking(futureDay(28));
    await waitForNotificationCount(h, host.id, 1);

    const cancel = await h.app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${bookingId}/cancel`,
      headers: authHeaders(guest.cookie),
      payload: {},
    });
    expect(cancel.statusCode).toBe(200);
    await waitForNotificationCount(h, host.id, 2);

    const cancelled = (await listNotifications(h, host)).notifications.find(
      (item) => item.type === 'booking_cancelled',
    );
    expect(cancelled?.payload.actorRole).toBe('guest');

    const repeat = await h.app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${bookingId}/cancel`,
      headers: authHeaders(guest.cookie),
      payload: {},
    });
    expect(repeat.statusCode).toBe(409);
    expect((await listNotifications(h, host)).notifications).toHaveLength(2);
  });

  it('напоминает хозяину об истечении заявки один раз', async () => {
    const listingId = await seedListing(h, host.id);
    const bookingId = await insertBookingRow(h, {
      listingId,
      guestId: guest.id,
      from: futureDay(30),
      to: futureDay(32),
      expiresAt: new Date(Date.now() + 2 * 3_600_000),
    });

    const jobs = createBookingJobs({
      db: h.db,
      config: h.config,
      events: h.events,
      logger: h.logger,
    });

    expect(await jobs.expiringSoon()).toBe(1);
    await waitForNotificationCount(h, host.id, 1);
    expect(await jobs.expiringSoon()).toBe(1);
    await sleep(100);

    const rows = await h.db.kysely
      .selectFrom('notifications')
      .select(['type', 'dedupe_key', 'payload'])
      .where('user_id', '=', host.id)
      .execute();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe('booking_expiring_soon');
    expect(rows[0]?.dedupe_key).toBe(`expiring:${bookingId}`);
    expect((rows[0]?.payload as unknown as { bookingId: string }).bookingId).toBe(bookingId);
  });

  it('сохраняет подписку, шлёт push и удаляет мёртвый endpoint', async () => {
    const subscription = await h.app.inject({
      method: 'POST',
      url: '/api/v1/me/push-subscriptions',
      headers: authHeaders(host.cookie),
      payload: {
        endpoint: 'https://fcm.googleapis.com/live-endpoint',
        keys: { p256dh: 'A'.repeat(40), auth: 'B'.repeat(20) },
        userAgent: 'Mozilla/5.0 Test',
      },
    });
    expect(subscription.statusCode).toBe(201);
    expect((subscription.json() as PushSubscriptionResponse).subscription.endpoint).toBe(
      'https://fcm.googleapis.com/live-endpoint',
    );

    const dead = await h.app.inject({
      method: 'POST',
      url: '/api/v1/me/push-subscriptions',
      headers: authHeaders(host.cookie),
      payload: {
        endpoint: 'https://fcm.googleapis.com/gone-endpoint',
        keys: { p256dh: 'C'.repeat(40), auth: 'D'.repeat(20) },
      },
    });
    expect(dead.statusCode).toBe(201);

    await newBooking(futureDay(34));
    await waitForNotificationCount(h, host.id, 1);
    await waitFor(() => sent.length === 1, 'push не отправлен за 2 секунды');

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      endpoint: 'https://fcm.googleapis.com/live-endpoint',
      title: 'Новая заявка',
      url: expect.stringMatching(/^\/bookings\//),
    });
    expect(sent[0]?.body).toContain('Дом у озера');

    let rows: Array<{ endpoint: string; last_used_at: Date | null }> = [];
    await waitFor(async () => {
      rows = await h.db.kysely
        .selectFrom('push_subscriptions')
        .select(['endpoint', 'last_used_at'])
        .where('user_id', '=', host.id)
        .orderBy('endpoint')
        .execute();

      return rows.length === 1 && rows[0]?.last_used_at !== null;
    }, 'подписка не обновилась');

    expect(rows.map((row) => row.endpoint)).toEqual(['https://fcm.googleapis.com/live-endpoint']);
    expect(rows[0]?.last_used_at).not.toBeNull();
  });

  it('не даёт удалить чужую подписку и отдаёт конфиг', async () => {
    const endpoint = 'https://fcm.googleapis.com/host-endpoint';
    await h.app.inject({
      method: 'POST',
      url: '/api/v1/me/push-subscriptions',
      headers: authHeaders(host.cookie),
      payload: { endpoint, keys: { p256dh: 'A'.repeat(40), auth: 'B'.repeat(20) } },
    });

    const config = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/push/config',
      headers: authHeaders(host.cookie),
    });
    expect(config.json()).toEqual({ enabled: true, publicKey: 'test-public-key' });

    const foreignDelete = await h.app.inject({
      method: 'DELETE',
      url: '/api/v1/me/push-subscriptions',
      headers: authHeaders(stranger.cookie),
      payload: { endpoint },
    });
    expect(foreignDelete.statusCode).toBe(204);
    const stillThere = await h.db.kysely
      .selectFrom('push_subscriptions')
      .select('id')
      .where('endpoint', '=', endpoint)
      .executeTakeFirst();
    expect(stillThere).toBeDefined();

    const ownDelete = await h.app.inject({
      method: 'DELETE',
      url: '/api/v1/me/push-subscriptions',
      headers: authHeaders(host.cookie),
      payload: { endpoint },
    });
    expect(ownDelete.statusCode).toBe(204);
    expect(
      await h.db.kysely
        .selectFrom('push_subscriptions')
        .select('id')
        .where('endpoint', '=', endpoint)
        .executeTakeFirst(),
    ).toBeUndefined();
  });

  it('отклоняет подписку на неподдерживаемый push-хост', async () => {
    const response = await h.app.inject({
      method: 'POST',
      url: '/api/v1/me/push-subscriptions',
      headers: authHeaders(host.cookie),
      payload: {
        endpoint: 'https://push.evil.example/endpoint',
        keys: { p256dh: 'A'.repeat(40), auth: 'B'.repeat(20) },
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'push_host_not_allowed' });
  });

  it('отвечает 503 на подписку, если VAPID не настроен', async () => {
    const disabled = await createHarness();

    try {
      const user = await createUser(disabled, 'no-push@example.ru', 'Без push');
      const response = await disabled.app.inject({
        method: 'POST',
        url: '/api/v1/me/push-subscriptions',
        headers: authHeaders(user.cookie),
        payload: {
          endpoint: 'https://fcm.googleapis.com/disabled',
          keys: { p256dh: 'A'.repeat(40), auth: 'B'.repeat(20) },
        },
      });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ code: 'push_not_configured' });
    } finally {
      await disabled.app.close();
      await disabled.db.close();
    }
  });
});
