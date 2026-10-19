import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hash } from '@node-rs/argon2';
import { runner } from 'node-pg-migrate';
import { Client } from 'pg';
import type { Logger } from 'pino';
import { describe } from 'vitest';
import { buildApp } from '../../src/app';
import type { AppConfig } from '../../src/platform/config/index';
import { createDb } from '../../src/platform/db/index';
import type { Db } from '../../src/platform/db/index';
import { createEventBus } from '../../src/platform/events/index';
import type { EventBus } from '../../src/platform/events/index';
import { createLogger } from '../../src/platform/logger/index';
import type { Mailer } from '../../src/platform/mailer/index';
import type { MediaStorage } from '../../src/platform/storage/index';
import type { AuthOptions } from '../../src/modules/auth/index';
import { usersService } from '../../src/modules/users/index';

const migrationsDir = fileURLToPath(new URL('../../../../db/migrations', import.meta.url));
const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));

export const TEST_PASSWORD = 'Forest-Lake-2026';
export const ACCESS_COOKIE = 'sn_access';

export function getTestDatabaseUrl(): string | undefined {
  if (!process.env.DATABASE_URL_TEST && existsSync(envFile)) process.loadEnvFile(envFile);
  return process.env.DATABASE_URL_TEST?.trim() || undefined;
}

export const databaseUrl = getTestDatabaseUrl();

if (!databaseUrl && process.env.CI) {
  throw new Error('В CI обязателен DATABASE_URL_TEST: иначе интеграционные тесты пропускаются.');
}

export const describeDatabase = databaseUrl ? describe : describe.skip;

export const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function databaseName(urlValue: string): string {
  return decodeURIComponent(new URL(urlValue).pathname.replace(/^\//, ''));
}

export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const url = databaseUrl ?? '';

  return {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 0,
    logLevel: 'silent',
    databaseUrl: url,
    corsOrigins: ['http://localhost:5173'],
    trustProxy: false,
    dbQueryTimeoutMs: 5000,
    webAppUrl: 'http://localhost:5173',
    listingTimeZone: 'Europe/Moscow',
    ...overrides,
    auth: {
      jwtSecret: 'test-secret-with-at-least-32-characters',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlDays: 30,
      requireEmailVerification: true,
      argon2: { memoryCost: 19_456, timeCost: 2, parallelism: 1 },
      ...overrides.auth,
    },
    mail: overrides.mail ?? {
      host: 'localhost',
      port: 1025,
      from: 'StayNest <no-reply@staynest.local>',
    },
    storage: overrides.storage ?? {
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
  };
}

const OPEN_AUTH: AuthOptions = {
  minimumResponseMs: 0,
  mailBudgetMs: 0,
  sleep: async () => undefined,
  rateLimits: {
    loginIp: { max: 10_000, windowMs: 60_000 },
    loginEmail: { max: 10_000, windowMs: 60_000 },
    registerIp: { max: 10_000, windowMs: 60_000 },
    registerEmail: { max: 10_000, windowMs: 60_000 },
    resetIp: { max: 10_000, windowMs: 60_000 },
    resetEmail: { max: 10_000, windowMs: 60_000 },
    resendIp: { max: 10_000, windowMs: 60_000 },
    resendEmail: { max: 10_000, windowMs: 60_000 },
    changePasswordIp: { max: 10_000, windowMs: 60_000 },
  },
};

const noopMailer: Mailer = {
  send: async () => undefined,
  close: () => undefined,
};

export type Harness = {
  app: Awaited<ReturnType<typeof buildApp>>;
  db: Db;
  config: AppConfig;
  events: EventBus;
  logger: Logger;
};

export async function resetTestSchema(url: string): Promise<Client> {
  if (!databaseName(url).endsWith('_test')) {
    throw new Error(`Отказ: ${databaseName(url)} не похожа на тестовую базу (суффикс _test).`);
  }

  const client = new Client({ connectionString: url });
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

  return client;
}

export async function createHarness(
  overrides: Partial<AppConfig> = {},
  storage?: MediaStorage,
): Promise<Harness> {
  const config = makeConfig(overrides);
  const logger = createLogger('silent', false);
  const db = createDb(databaseUrl ?? '', logger, 5000);
  const events = createEventBus(logger);
  const app = await buildApp({
    config,
    logger,
    db,
    mailer: noopMailer,
    events,
    auth: OPEN_AUTH,
    storage,
  });

  return { app, db, config, events, logger };
}

export type TestUser = {
  id: string;
  email: string;
  cookie: string;
};

export async function createUser(
  h: Harness,
  email: string,
  displayName = 'Анна',
): Promise<TestUser> {
  const user = await usersService.create(h.db.kysely, {
    email,
    passwordHash: await hash(TEST_PASSWORD),
    displayName,
    locale: 'ru',
    emailVerifiedAt: new Date(),
  });

  const response = await h.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: TEST_PASSWORD },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Не удалось войти тестовым пользователем: ${response.statusCode}`);
  }

  const access = response.cookies.find((cookie) => cookie.name === ACCESS_COOKIE)?.value;
  if (!access) throw new Error('В ответе логина нет access cookie');

  return { id: user.id, email, cookie: `${ACCESS_COOKIE}=${access}` };
}

export function authHeaders(cookie: string): Record<string, string> {
  return { cookie };
}
