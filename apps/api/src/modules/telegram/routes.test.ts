import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app';
import type { AppConfig } from '../../platform/config/index';
import { createDb } from '../../platform/db/index';
import type { Db } from '../../platform/db/index';
import { createEventBus } from '../../platform/events/index';
import type { EventBus } from '../../platform/events/index';
import { createLogger } from '../../platform/logger/index';
import type { TelegramBot, TelegramSender } from './index';
import { buildDataCheckString, signInitData } from './validation';

const migrationsDir = fileURLToPath(new URL('../../../../../db/migrations', import.meta.url));
const envFile = fileURLToPath(new URL('../../../../../.env', import.meta.url));

function getTestDatabaseUrl(): string | undefined {
  if (!process.env.DATABASE_URL_TEST && existsSync(envFile)) process.loadEnvFile(envFile);
  return process.env.DATABASE_URL_TEST?.trim() || undefined;
}

const databaseUrl = getTestDatabaseUrl();
const url = databaseUrl ?? '';
const describeDatabase = databaseUrl ? describe : describe.skip;

const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function databaseName(value: string): string {
  return decodeURIComponent(new URL(value).pathname.replace(/^\//, ''));
}

function assertTestDatabase(value: string): void {
  if (!databaseName(value).endsWith('_test')) {
    throw new Error(`Отказ: ${databaseName(value)} не похожа на тестовую базу.`);
  }
}

const BOT_TOKEN = '123456:test-bot-token';
const WEBHOOK_SECRET = 'test-telegram-webhook-secret-32-chars';
const NOW = new Date();

function makeConfig(telegramEnabled = true): AppConfig {
  return {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 0,
    logLevel: 'silent',
    databaseUrl: url,
    corsOrigins: ['http://localhost:5173'],
    trustProxy: false,
    dbQueryTimeoutMs: 5000,
    webAppUrl: 'https://staynest.example',
    listingTimeZone: 'Europe/Moscow',
    auth: {
      jwtSecret: 'test-secret-with-at-least-32-characters',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlDays: 30,
      requireEmailVerification: true,
      argon2: { memoryCost: 19_456, timeCost: 2, parallelism: 1 },
    },
    mail: { host: 'localhost', port: 1025, from: 'StayNest <no-reply@staynest.local>' },
    payments: {
      mockEnabled: true,
      depositPercent: 20,
      depositTtlHours: 48,
      webhookSecret: 'test-payment-webhook-secret-with-32-chars',
    },
    telegram: {
      enabled: telegramEnabled,
      botToken: telegramEnabled ? BOT_TOKEN : null,
      webhookSecret: telegramEnabled ? WEBHOOK_SECRET : null,
      initDataMaxAgeSeconds: 3600,
    },
    storage: {
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      bucket: 'staynest-media',
      accessKey: 'test',
      secretKey: 'test-secret',
      publicPath: '/media',
      maxUploadBytes: 10 * 1024 * 1024,
      maxPerListing: 20,
      maxPixels: 40_000_000,
    },
    booking: {
      requestTtlHours: 24,
      expiryWarningHours: 3,
      maxActivePending: 5,
      rateLimit: { max: 1_000, windowMs: 60_000 },
    },
    push: {
      enabled: false,
      publicKey: null,
      privateKey: null,
      subject: 'mailto:test@staynest.local',
    },
  };
}

type InitDataOptions = {
  userId?: number;
  authDate?: number;
  token?: string;
};

function initData({ userId = 123_456_789, authDate, token = BOT_TOKEN }: InitDataOptions = {}) {
  const params = new URLSearchParams();
  params.set('query_id', 'AAHtest');
  params.set(
    'user',
    JSON.stringify({
      id: userId,
      first_name: 'Анна',
      username: 'anna_p',
      language_code: 'ru',
    }),
  );
  params.set('auth_date', String(authDate ?? Math.floor(NOW.getTime() / 1000)));
  const hash = signInitData(buildDataCheckString(params), token);
  params.set('hash', hash);
  return params.toString();
}

function fakeBot(): TelegramBot & { sendMessage: ReturnType<typeof vi.fn> } {
  return {
    enabled: true,
    sendMessage: vi.fn().mockResolvedValue({ ok: true }),
  };
}

function fakeSender(): TelegramSender & { send: ReturnType<typeof vi.fn> } {
  return {
    enabled: true,
    send: vi.fn().mockResolvedValue({ ok: true }),
  };
}

type Harness = {
  app: Awaited<ReturnType<typeof buildApp>>;
  db: Db;
  bot: ReturnType<typeof fakeBot>;
  sender: ReturnType<typeof fakeSender>;
  events: EventBus;
};

describeDatabase('Telegram API', () => {
  let client: Client;
  let harness: Harness | undefined;

  function active(): Harness {
    if (!harness) throw new Error('Тестовый стенд не создан');
    return harness;
  }

  beforeAll(async () => {
    if (!url) return;
    assertTestDatabase(url);
    client = new Client({ connectionString: url });
    await client.connect();
    await client.query("SET lock_timeout = '5s'");
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    await runner({
      databaseUrl: url,
      dir: migrationsDir,
      direction: 'up',
      count: Infinity,
      migrationsTable: 'pgmigrations',
      logger: silentLogger,
    });
  });

  beforeEach(async () => {
    if (!url) return;
    await client.query('TRUNCATE users RESTART IDENTITY CASCADE');
    if (harness) {
      await harness.app.close();
      await harness.db.close();
    }
    const logger = createLogger('silent', false);
    const db = createDb(url, logger, 5000);
    const bot = fakeBot();
    const sender = fakeSender();
    const events = createEventBus(logger);
    const app = await buildApp({
      config: makeConfig(),
      logger,
      db,
      events,
      telegramBot: bot,
      telegramSender: sender,
    });
    harness = { app, db, bot, sender, events };
  });

  afterAll(async () => {
    if (harness) {
      await harness.app.close();
      await harness.db.close();
    }
    await client?.end();
  });

  it('входит по initData, создаёт аккаунт и переиспользует его', async () => {
    const first = await active().app.inject({
      method: 'POST',
      url: '/api/v1/auth/telegram',
      payload: { initData: initData() },
    });

    expect(first.statusCode).toBe(200);
    const body = first.json() as { user: { id: string; email: string; displayName: string } };
    expect(body.user.email).toBe('tg123456789@telegram.invalid');
    expect(body.user.displayName).toBe('Анна');
    expect(first.cookies.some((cookie) => cookie.name === 'sn_access')).toBe(true);
    expect(first.cookies.some((cookie) => cookie.name === 'sn_refresh')).toBe(true);

    const second = await active().app.inject({
      method: 'POST',
      url: '/api/v1/auth/telegram',
      payload: { initData: initData() },
    });

    expect(second.json()).toMatchObject({ user: { id: body.user.id } });

    const users = await client.query('SELECT count(*)::int AS count FROM users');
    const identities = await client.query('SELECT count(*)::int AS count FROM telegram_identities');
    expect(users.rows[0].count).toBe(1);
    expect(identities.rows[0].count).toBe(1);
  });

  it('отвергает подделанную подпись', async () => {
    const response = await active().app.inject({
      method: 'POST',
      url: '/api/v1/auth/telegram',
      payload: { initData: initData({ token: '999:attacker-token' }) },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'invalid_init_data' });
  });

  it('отвергает просроченный initData', async () => {
    const authDate = Math.floor(NOW.getTime() / 1000) - 7200;
    const response = await active().app.inject({
      method: 'POST',
      url: '/api/v1/auth/telegram',
      payload: { initData: initData({ authDate }) },
    });

    expect(response.statusCode).toBe(401);
  });

  it('возвращает 503, когда Telegram не настроен', async () => {
    const logger = createLogger('silent', false);
    const db = createDb(url, logger, 5000);
    const app = await buildApp({ config: makeConfig(false), logger, db });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/telegram',
      payload: { initData: initData() },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: 'telegram_disabled' });
    await app.close();
    await db.close();
  });

  it('проверяет секрет вебхука и отправляет кнопку Mini App на /start', async () => {
    const bad = await active().app.inject({
      method: 'POST',
      url: '/api/v1/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong-secret' },
      payload: { message: { text: '/start', chat: { id: 42 } } },
    });
    expect(bad.statusCode).toBe(401);
    expect(active().bot.sendMessage).not.toHaveBeenCalled();

    const good = await active().app.inject({
      method: 'POST',
      url: '/api/v1/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': WEBHOOK_SECRET },
      payload: { message: { text: '/start', chat: { id: 42 } } },
    });

    expect(good.statusCode).toBe(200);
    expect(active().bot.sendMessage).toHaveBeenCalledTimes(1);
    const [chatId, text, keyboard] = active().bot.sendMessage.mock.calls[0] as [
      string,
      string,
      { inline_keyboard: Array<Array<{ web_app?: { url: string } }>> },
    ];
    expect(chatId).toBe('42');
    expect(text).toContain('StayNest');
    expect(keyboard.inline_keyboard[0]?.[0]?.web_app?.url).toBe('https://staynest.example');
  });

  it('игнорирует неизвестные команды и мусор', async () => {
    const response = await active().app.inject({
      method: 'POST',
      url: '/api/v1/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': WEBHOOK_SECRET },
      payload: { message: { text: '/help', chat: { id: 42 } } },
    });

    expect(response.statusCode).toBe(200);
    expect(active().bot.sendMessage).not.toHaveBeenCalled();
  });

  it('отправляет уведомление о заявке в Telegram хоста', async () => {
    const login = await active().app.inject({
      method: 'POST',
      url: '/api/v1/auth/telegram',
      payload: { initData: initData() },
    });
    const hostId = (login.json() as { user: { id: string } }).user.id;

    active().events.publish('booking.requested', {
      bookingId: '00000000-0000-4000-9000-000000000777',
      listingId: '00000000-0000-4000-9000-000000000778',
      guestId: '00000000-0000-4000-9000-000000000779',
      hostId,
      status: 'pending',
      occurredAt: new Date().toISOString(),
      listingTitle: 'Дом у озера',
      checkIn: '2026-11-10',
      checkOut: '2026-11-12',
      guestName: 'Иван',
      totalMinor: 250_000,
      currency: 'RUB',
    });

    await vi.waitFor(() => expect(active().sender.send).toHaveBeenCalledTimes(1));

    const [chatId, message] = active().sender.send.mock.calls[0] as [
      string,
      { title: string; body: string; url: string },
    ];
    expect(chatId).toBe('123456789');
    expect(message.title).toBe('Новая заявка');
    expect(message.body).toContain('Дом у озера');
    expect(message.url).toBe(
      'https://staynest.example/bookings/00000000-0000-4000-9000-000000000777',
    );
  });
});
