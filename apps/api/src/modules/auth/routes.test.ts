import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import { Client } from 'pg';
import type { Logger } from 'pino';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import type { AppConfig } from '../../platform/config/index';
import { createDb } from '../../platform/db/index';
import type { Db } from '../../platform/db/index';
import { createEventBus } from '../../platform/events/index';
import type { EventBus } from '../../platform/events/index';
import { createLogger } from '../../platform/logger/index';
import type { MailMessage, Mailer } from '../../platform/mailer/index';
import type { AuthOptions } from './service-context';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './tokens';

const migrationsDir = fileURLToPath(new URL('../../../../../db/migrations', import.meta.url));
const envFile = fileURLToPath(new URL('../../../../../.env', import.meta.url));
const JWT_SECRET = 'test-secret-with-at-least-32-characters';
const PASSWORD = 'Forest-Lake-2026';
const NEW_PASSWORD = 'Mountain-River-2027';

function getTestDatabaseUrl(): string | undefined {
  if (!process.env.DATABASE_URL_TEST && existsSync(envFile)) process.loadEnvFile(envFile);
  return process.env.DATABASE_URL_TEST?.trim() || undefined;
}

const databaseUrl = getTestDatabaseUrl();

if (!databaseUrl && process.env.CI) {
  throw new Error('В CI обязателен DATABASE_URL_TEST: иначе тесты auth молча пропускаются.');
}

const url = databaseUrl ?? '';
const describeDatabase = databaseUrl ? describe : describe.skip;

const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
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

function makeConfig(): AppConfig {
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
    auth: {
      jwtSecret: JWT_SECRET,
      accessTokenTtlSeconds: 900,
      refreshTokenTtlDays: 30,
      requireEmailVerification: true,
      argon2: { memoryCost: 19_456, timeCost: 2, parallelism: 1 },
    },
    mail: { host: 'localhost', port: 1025, from: 'StayNest <no-reply@staynest.local>' },
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
  };
}

const OPEN_OPTIONS: AuthOptions = {
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

type FakeMailer = {
  messages: MailMessage[];
  mailer: Mailer;
  last: (tag: string) => MailMessage;
};

function createFakeMailer(): FakeMailer {
  const messages: MailMessage[] = [];

  return {
    messages,
    mailer: {
      async send(message) {
        messages.push(message);
      },
      close() {
        return undefined;
      },
    },
    last(tag) {
      const found = [...messages].reverse().find((message) => message.tag === tag);
      if (!found) throw new Error(`Письмо с тегом ${tag} не отправлено`);
      return found;
    },
  };
}

type Harness = {
  app: Awaited<ReturnType<typeof buildApp>>;
  db: Db;
  config: AppConfig;
  mail: FakeMailer;
  events: EventBus;
  logger: Logger;
};

async function createHarness(overrides?: {
  auth?: AuthOptions;
  logger?: Logger;
  config?: Partial<AppConfig>;
}): Promise<Harness> {
  const config = { ...makeConfig(), ...overrides?.config };
  const logger = overrides?.logger ?? createLogger('silent', false);
  const db = createDb(url, logger, 5000);
  const events = createEventBus(logger);
  const mail = createFakeMailer();
  const app = await buildApp({
    config,
    logger,
    db,
    mailer: mail.mailer,
    events,
    auth: { ...OPEN_OPTIONS, ...overrides?.auth },
  });

  return { app, db, config, mail, events, logger };
}

const activeHarnesses: Harness[] = [];

async function harness(options?: Parameters<typeof createHarness>[0]): Promise<Harness> {
  const created = await createHarness(options);
  activeHarnesses.push(created);
  return created;
}

function tokenFromMessage(message: MailMessage): string {
  const match = /token=([A-Za-z0-9_-]+)/.exec(message.text);
  if (!match?.[1]) throw new Error('В письме нет токена');
  return decodeURIComponent(match[1]);
}

function cookieValue(response: { cookies: Array<{ name: string; value: string }> }, name: string) {
  return response.cookies.find((cookie) => cookie.name === name)?.value;
}

async function register(
  h: Harness,
  email = 'user@example.ru',
  password = PASSWORD,
  displayName = 'Анна',
) {
  return h.app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password, displayName },
  });
}

async function verifyEmail(h: Harness, token: string, password = PASSWORD) {
  return h.app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-email',
    payload: { token, password },
  });
}

async function login(h: Harness, email = 'user@example.ru', password = PASSWORD) {
  return h.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
}

async function registerVerifyLogin(h: Harness, email = 'user@example.ru') {
  const registered = await register(h, email);
  if (registered.statusCode !== 202) {
    throw new Error(`Регистрация не удалась: ${registered.statusCode} ${registered.body}`);
  }
  const token = tokenFromMessage(h.mail.last('verify_email'));
  await verifyEmail(h, token);
  return login(h, email);
}

describeDatabase('auth API', () => {
  let client: Client;

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

  it('регистрирует пользователя, хэширует пароль и отправляет письмо', async () => {
    const h = await harness();
    let registered: unknown;

    h.events.subscribe('user.registered', (payload) => {
      registered = payload;
    });

    const response = await register(h);

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      status: 'accepted',
      emailVerificationRequired: true,
    });
    expect(response.body).not.toContain(PASSWORD);

    const user = await h.db.kysely.selectFrom('users').selectAll().executeTakeFirstOrThrow();
    expect(user.email).toBe('user@example.ru');
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    expect(user.password_hash).not.toContain(PASSWORD);
    expect(user.email_verified_at).toBeNull();

    const token = tokenFromMessage(h.mail.last('verify_email'));
    const authToken = await h.db.kysely
      .selectFrom('auth_tokens')
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(authToken.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(authToken.token_hash).not.toBe(token);
    expect(registered).toMatchObject({ userId: user.id, locale: 'ru' });
  });

  it('одинаково отвечает на повторную регистрацию и не создаёт дубль', async () => {
    const h = await harness();

    const first = await register(h, 'user@example.ru');
    const second = await register(h, 'USER@example.ru');

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(second.json()).toEqual(first.json());

    const count = await h.db.kysely
      .selectFrom('users')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    expect(count.count).toBe('1');

    const verifyTokens = await h.db.kysely
      .selectFrom('auth_tokens')
      .select('id')
      .where('kind', '=', 'verify_email')
      .execute();
    expect(verifyTokens).toHaveLength(1);
    expect(h.mail.messages.map((message) => message.tag)).toEqual([
      'verify_email',
      'account_exists',
    ]);
  });

  it('не принимает слабый пароль при регистрации', async () => {
    const h = await harness();

    const common = await register(h, 'weak@example.ru', '1234567890');
    expect(common.statusCode).toBe(422);
    expect(common.json()).toMatchObject({ code: 'weak_password' });

    const identity = await register(h, 'anna@example.ru', 'anna-Forest-2026');
    expect(identity.statusCode).toBe(422);
    expect(identity.json()).toMatchObject({ code: 'weak_password' });

    const users = await h.db.kysely.selectFrom('users').select('id').execute();
    expect(users).toHaveLength(0);
  });

  it('подтверждение email задаёт пароль и закрывает pre-hijack', async () => {
    const h = await harness();
    await register(h, 'victim@example.ru', 'Attacker-Pass-2026', 'Victim');
    const token = tokenFromMessage(h.mail.last('verify_email'));

    const verified = await verifyEmail(h, token, NEW_PASSWORD);
    expect(verified.statusCode).toBe(204);

    expect((await login(h, 'victim@example.ru', 'Attacker-Pass-2026')).statusCode).toBe(401);
    expect((await login(h, 'victim@example.ru', NEW_PASSWORD)).statusCode).toBe(200);
  });

  it('возвращает одинаковый 401 на неверный пароль и несуществующий email', async () => {
    const h = await harness();
    await registerVerifyLogin(h);

    const wrongPassword = await login(h, 'user@example.ru', 'Wrong-Password-2026');
    const unknownEmail = await login(h, 'nobody@example.ru', PASSWORD);

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual(unknownEmail.json());
    expect(wrongPassword.json()).toMatchObject({ code: 'invalid_credentials' });
    expect(wrongPassword.cookies).toHaveLength(0);
  });

  it('ставит httpOnly Lax cookies, хранит refresh только хэшем и пускает в /me', async () => {
    const h = await harness();
    const response = await registerVerifyLogin(h);

    expect(response.statusCode).toBe(200);
    const access = cookieValue(response, ACCESS_COOKIE);
    const refresh = cookieValue(response, REFRESH_COOKIE);
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();

    const accessCookie = response.cookies.find((cookie) => cookie.name === ACCESS_COOKIE);
    const refreshCookie = response.cookies.find((cookie) => cookie.name === REFRESH_COOKIE);
    expect(accessCookie).toMatchObject({ httpOnly: true, path: '/' });
    expect(refreshCookie).toMatchObject({ httpOnly: true, path: '/api/v1/auth' });
    expect(accessCookie?.secure).toBeFalsy();
    expect(refreshCookie?.secure).toBeFalsy();
    expect(String(accessCookie?.sameSite).toLowerCase()).toBe('lax');

    const expectedHash = createHash('sha256')
      .update(refresh ?? '')
      .digest('hex');
    const stored = await h.db.kysely
      .selectFrom('refresh_tokens')
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(stored.token_hash).toBe(expectedHash);
    expect(stored.token_hash).not.toBe(refresh);

    const me = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${access}` },
    });

    expect(me.statusCode).toBe(200);
    expect(me.headers['cache-control']).toBe('private, no-store');
    expect(me.json()).toMatchObject({
      user: { email: 'user@example.ru', emailVerified: true, locale: 'ru' },
    });
    expect(me.body).not.toContain('password');
  });

  it('закрывает /me без access-токена', async () => {
    const h = await harness();

    const response = await h.app.inject({ method: 'GET', url: '/api/v1/me' });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ code: 'unauthorized' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('ротирует refresh и отзывает всю цепочку при повторном использовании', async () => {
    const h = await harness();
    const loginResponse = await registerVerifyLogin(h);
    const oldRefresh = cookieValue(loginResponse, REFRESH_COOKIE);

    const rotated = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `${REFRESH_COOKIE}=${oldRefresh}` },
    });

    expect(rotated.statusCode).toBe(200);
    const newRefresh = cookieValue(rotated, REFRESH_COOKIE);
    const newAccess = cookieValue(rotated, ACCESS_COOKIE);
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(oldRefresh);

    const reuse = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `${REFRESH_COOKIE}=${oldRefresh}` },
    });
    expect(reuse.statusCode).toBe(401);
    expect(reuse.json()).toMatchObject({ code: 'invalid_token' });

    const afterReuse = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `${REFRESH_COOKIE}=${newRefresh}` },
    });
    expect(afterReuse.statusCode).toBe(401);

    const me = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${newAccess}` },
    });
    expect(me.statusCode).toBe(401);

    const active = await h.db.kysely
      .selectFrom('refresh_tokens')
      .select('id')
      .where('revoked_at', 'is', null)
      .execute();
    expect(active).toHaveLength(0);
  });

  it('разлогинивает текущую сессию и сразу закрывает /me', async () => {
    const h = await harness();
    const loginResponse = await registerVerifyLogin(h);
    const access = cookieValue(loginResponse, ACCESS_COOKIE);
    const refresh = cookieValue(loginResponse, REFRESH_COOKIE);

    const logout = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: `${REFRESH_COOKIE}=${refresh}` },
    });
    expect(logout.statusCode).toBe(204);

    const me = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${access}` },
    });
    expect(me.statusCode).toBe(401);

    const refreshAfter = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `${REFRESH_COOKIE}=${refresh}` },
    });
    expect(refreshAfter.statusCode).toBe(401);
  });

  it('logout со старым refresh отзывает всю family', async () => {
    const h = await harness();
    const loginResponse = await registerVerifyLogin(h);
    const oldRefresh = cookieValue(loginResponse, REFRESH_COOKIE);

    const rotated = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `${REFRESH_COOKIE}=${oldRefresh}` },
    });
    const newRefresh = cookieValue(rotated, REFRESH_COOKIE);
    const newAccess = cookieValue(rotated, ACCESS_COOKIE);

    const logout = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: `${REFRESH_COOKIE}=${oldRefresh}` },
    });
    expect(logout.statusCode).toBe(204);

    const refreshAfter = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `${REFRESH_COOKIE}=${newRefresh}` },
    });
    expect(refreshAfter.statusCode).toBe(401);

    const me = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${newAccess}` },
    });
    expect(me.statusCode).toBe(401);
  });

  it('logout только с access-токеном тоже отзывает сессию', async () => {
    const h = await harness();
    const loginResponse = await registerVerifyLogin(h);
    const access = cookieValue(loginResponse, ACCESS_COOKIE);

    const logout = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: `${ACCESS_COOKIE}=${access}` },
    });
    expect(logout.statusCode).toBe(204);

    const me = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${access}` },
    });
    expect(me.statusCode).toBe(401);
  });

  it('при выключенном REQUIRE_EMAIL_VERIFICATION пускает без письма', async () => {
    const base = makeConfig();
    const h = await harness({
      config: { auth: { ...base.auth, requireEmailVerification: false } },
    });

    const registered = await register(h);
    expect(registered.statusCode).toBe(202);
    expect(registered.json()).toEqual({
      status: 'accepted',
      emailVerificationRequired: false,
    });
    expect(h.mail.messages).toHaveLength(0);

    const loginResponse = await login(h);
    expect(loginResponse.statusCode).toBe(200);
    const me = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${cookieValue(loginResponse, ACCESS_COOKIE)}` },
    });
    expect(me.json()).toMatchObject({ user: { emailVerified: true } });
  });

  it('не пускает до подтверждения email, переотправляет письмо и гасит старую ссылку', async () => {
    const h = await harness();
    await register(h);
    const firstToken = tokenFromMessage(h.mail.last('verify_email'));

    const loginBeforeVerify = await login(h);
    expect(loginBeforeVerify.statusCode).toBe(403);
    expect(loginBeforeVerify.json()).toMatchObject({ code: 'email_not_verified' });

    const resend = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: { email: 'user@example.ru' },
    });
    expect(resend.statusCode).toBe(202);

    const oldToken = await verifyEmail(h, firstToken);
    expect(oldToken.statusCode).toBe(400);

    const secondToken = tokenFromMessage(h.mail.last('verify_email'));
    const verified = await verifyEmail(h, secondToken);
    expect(verified.statusCode).toBe(204);

    const loginAfterVerify = await login(h);
    expect(loginAfterVerify.statusCode).toBe(200);
    const access = cookieValue(loginAfterVerify, ACCESS_COOKIE);
    const me = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${access}` },
    });
    expect(me.json()).toMatchObject({ user: { emailVerified: true } });

    const messagesBefore = h.mail.messages.length;
    const resendAgain = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: { email: 'user@example.ru' },
    });
    expect(resendAgain.statusCode).toBe(202);
    expect(h.mail.messages).toHaveLength(messagesBefore);
  });

  it('сбрасывает пароль, отзывает сессии и отдаёт одинаковый ответ на любой email', async () => {
    const h = await harness();
    const loginResponse = await registerVerifyLogin(h);
    const oldRefresh = cookieValue(loginResponse, REFRESH_COOKIE);

    const unknown = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'nobody@example.ru' },
    });
    const known = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'user@example.ru' },
    });

    expect(unknown.statusCode).toBe(202);
    expect(known.statusCode).toBe(202);
    expect(unknown.json()).toEqual(known.json());
    expect(h.mail.messages.filter((message) => message.tag === 'reset_password')).toHaveLength(1);

    const resetToken = tokenFromMessage(h.mail.last('reset_password'));
    const reset = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: resetToken, password: NEW_PASSWORD },
    });
    expect(reset.statusCode).toBe(204);

    const oldLogin = await login(h, 'user@example.ru', PASSWORD);
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await login(h, 'user@example.ru', NEW_PASSWORD);
    expect(newLogin.statusCode).toBe(200);

    const oldRefreshResponse = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `${REFRESH_COOKIE}=${oldRefresh}` },
    });
    expect(oldRefreshResponse.statusCode).toBe(401);

    const reuse = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: resetToken, password: NEW_PASSWORD },
    });
    expect(reuse.statusCode).toBe(400);
  });

  it('не принимает слабый пароль и не расходует ссылку сброса', async () => {
    const h = await harness();
    await registerVerifyLogin(h);
    await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'user@example.ru' },
    });
    const resetToken = tokenFromMessage(h.mail.last('reset_password'));

    const weak = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: resetToken, password: '1234567890' },
    });
    expect(weak.statusCode).toBe(422);
    expect(weak.json()).toMatchObject({ code: 'weak_password' });

    const good = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: resetToken, password: NEW_PASSWORD },
    });
    expect(good.statusCode).toBe(204);
  });

  it('отклоняет истёкшую ссылку сброса', async () => {
    const h = await harness();
    await registerVerifyLogin(h);
    await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'user@example.ru' },
    });
    const resetToken = tokenFromMessage(h.mail.last('reset_password'));

    await client.query(
      `UPDATE auth_tokens SET expires_at = now() - interval '1 minute' WHERE kind = 'reset_password'`,
    );

    const response = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: resetToken, password: NEW_PASSWORD },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'invalid_link_token' });
  });

  it('меняет пароль только при верном текущем и отзывает сессии', async () => {
    const h = await harness();
    const loginResponse = await registerVerifyLogin(h);
    const access = cookieValue(loginResponse, ACCESS_COOKIE);

    await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'user@example.ru' },
    });
    const resetToken = tokenFromMessage(h.mail.last('reset_password'));

    for (let index = 0; index < 5; index += 1) {
      const wrong = await h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { cookie: `${ACCESS_COOKIE}=${access}` },
        payload: { currentPassword: 'Wrong-Password-2026', newPassword: NEW_PASSWORD },
      });
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json()).toMatchObject({ code: 'current_password_invalid' });
    }

    const changed = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { cookie: `${ACCESS_COOKIE}=${access}` },
      payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    });
    expect(changed.statusCode).toBe(204);

    const staleReset = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: resetToken, password: NEW_PASSWORD },
    });
    expect(staleReset.statusCode).toBe(400);

    const oldMe = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${access}` },
    });
    expect(oldMe.statusCode).toBe(401);

    expect((await login(h, 'user@example.ru', PASSWORD)).statusCode).toBe(401);
    expect((await login(h, 'user@example.ru', NEW_PASSWORD)).statusCode).toBe(200);
  });

  it('ограничивает перебор текущего пароля по IP', async () => {
    const h = await harness({
      auth: {
        rateLimits: {
          changePasswordIp: { max: 2, windowMs: 60_000 },
        },
        sleep: async () => undefined,
        minimumResponseMs: 0,
        mailBudgetMs: 0,
      },
    });
    const loginResponse = await registerVerifyLogin(h);
    const access = cookieValue(loginResponse, ACCESS_COOKIE);

    const attempt = () =>
      h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { cookie: `${ACCESS_COOKIE}=${access}` },
        payload: { currentPassword: 'Wrong-Password-2026', newPassword: NEW_PASSWORD },
      });

    expect((await attempt()).statusCode).toBe(400);
    expect((await attempt()).statusCode).toBe(400);
    const limited = await attempt();
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeTruthy();
  });

  it('показывает сессии и выходит на всех устройствах', async () => {
    const h = await harness();
    const firstLogin = await registerVerifyLogin(h);
    const firstAccess = cookieValue(firstLogin, ACCESS_COOKIE);

    const secondLogin = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'user-agent': 'SecondDevice/1.0' },
      payload: { email: 'user@example.ru', password: PASSWORD },
    });
    expect(secondLogin.statusCode).toBe(200);

    const sessions = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/sessions',
      headers: { cookie: `${ACCESS_COOKIE}=${firstAccess}` },
    });
    expect(sessions.statusCode).toBe(200);
    const body = sessions.json() as {
      sessions: Array<{ current: boolean; userAgent: string | null }>;
    };
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions.filter((session) => session.current)).toHaveLength(1);

    const revoke = await h.app.inject({
      method: 'DELETE',
      url: '/api/v1/me/sessions',
      headers: { cookie: `${ACCESS_COOKIE}=${firstAccess}` },
    });
    expect(revoke.statusCode).toBe(204);

    for (const response of [firstLogin, secondLogin]) {
      const refresh = cookieValue(response, REFRESH_COOKIE);
      const refreshed = await h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE}=${refresh}` },
      });
      expect(refreshed.statusCode).toBe(401);
    }

    const me = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${firstAccess}` },
    });
    expect(me.statusCode).toBe(401);
  });

  it('не оставляет живую сессию, если выход на всех гоняется с refresh', async () => {
    const h = await harness();
    const loginResponse = await registerVerifyLogin(h);
    const access = cookieValue(loginResponse, ACCESS_COOKIE);
    const refresh = cookieValue(loginResponse, REFRESH_COOKIE);

    await client.query(`
      CREATE OR REPLACE FUNCTION staynest_delay_refresh_insert() RETURNS trigger AS $$
      BEGIN PERFORM pg_sleep(0.5); RETURN NEW; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER staynest_delay_refresh_insert
        BEFORE INSERT ON refresh_tokens
        FOR EACH ROW EXECUTE FUNCTION staynest_delay_refresh_insert();
    `);

    try {
      const refreshing = h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE}=${refresh}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
      const revoking = h.app.inject({
        method: 'DELETE',
        url: '/api/v1/me/sessions',
        headers: { cookie: `${ACCESS_COOKIE}=${access}` },
      });

      const [refreshResponse, revokeResponse] = await Promise.all([refreshing, revoking]);
      expect(revokeResponse.statusCode).toBe(204);
      expect(refreshResponse.statusCode).toBe(200);

      const newRefresh = cookieValue(refreshResponse, REFRESH_COOKIE);
      const newAccess = cookieValue(refreshResponse, ACCESS_COOKIE);

      const retry = await h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE}=${newRefresh}` },
      });
      expect(retry.statusCode).toBe(401);

      const me = await h.app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { cookie: `${ACCESS_COOKIE}=${newAccess}` },
      });
      expect(me.statusCode).toBe(401);
    } finally {
      await client.query('DROP TRIGGER IF EXISTS staynest_delay_refresh_insert ON refresh_tokens');
      await client.query('DROP FUNCTION IF EXISTS staynest_delay_refresh_insert()');
    }
  });

  it('не оставляет живую сессию, если смена пароля гоняется с refresh', async () => {
    const h = await harness();
    const loginResponse = await registerVerifyLogin(h);
    const access = cookieValue(loginResponse, ACCESS_COOKIE);
    const refresh = cookieValue(loginResponse, REFRESH_COOKIE);

    await client.query(`
      CREATE OR REPLACE FUNCTION staynest_delay_refresh_insert() RETURNS trigger AS $$
      BEGIN PERFORM pg_sleep(0.5); RETURN NEW; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER staynest_delay_refresh_insert
        BEFORE INSERT ON refresh_tokens
        FOR EACH ROW EXECUTE FUNCTION staynest_delay_refresh_insert();
    `);

    try {
      const refreshing = h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE}=${refresh}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
      const changing = h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { cookie: `${ACCESS_COOKIE}=${access}` },
        payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      });

      const [refreshResponse, changeResponse] = await Promise.all([refreshing, changing]);
      expect(refreshResponse.statusCode).toBe(200);
      expect(changeResponse.statusCode).toBe(204);

      const newRefresh = cookieValue(refreshResponse, REFRESH_COOKIE);
      const newAccess = cookieValue(refreshResponse, ACCESS_COOKIE);

      const retry = await h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE}=${newRefresh}` },
      });
      expect(retry.statusCode).toBe(401);

      const me = await h.app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { cookie: `${ACCESS_COOKIE}=${newAccess}` },
      });
      expect(me.statusCode).toBe(401);
    } finally {
      await client.query('DROP TRIGGER IF EXISTS staynest_delay_refresh_insert ON refresh_tokens');
      await client.query('DROP FUNCTION IF EXISTS staynest_delay_refresh_insert()');
    }
  });

  it('правит профиль и отвергает лишние поля', async () => {
    const h = await harness();
    const loginResponse = await registerVerifyLogin(h);
    const access = cookieValue(loginResponse, ACCESS_COOKIE);

    const updated = await h.app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${access}` },
      payload: { displayName: 'Анна Петрова', phone: '', locale: 'en' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      user: { displayName: 'Анна Петрова', phone: null, locale: 'en' },
    });

    const extra = await h.app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${access}` },
      payload: { email: 'hacker@example.ru' },
    });
    expect(extra.statusCode).toBe(422);
    expect(extra.json()).toMatchObject({ code: 'validation_error' });

    const empty = await h.app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: { cookie: `${ACCESS_COOKIE}=${access}` },
      payload: {},
    });
    expect(empty.statusCode).toBe(422);
  });

  it('ограничивает вход по IP, но не блокирует аккаунт по email', async () => {
    const byIp = await harness({
      auth: {
        rateLimits: {
          loginIp: { max: 2, windowMs: 60_000 },
          loginEmail: { max: 10_000, windowMs: 60_000 },
        },
      },
    });

    const first = await login(byIp, 'nobody@example.ru');
    const second = await login(byIp, 'nobody@example.ru');
    const third = await login(byIp, 'nobody@example.ru');

    expect(first.statusCode).toBe(401);
    expect(second.statusCode).toBe(401);
    expect(third.statusCode).toBe(429);
    expect(third.headers['retry-after']).toBeTruthy();

    const byEmail = await harness({
      auth: {
        rateLimits: {
          loginIp: { max: 10_000, windowMs: 60_000 },
          loginEmail: { max: 2, windowMs: 60_000 },
        },
      },
    });
    await registerVerifyLogin(byEmail);

    for (let index = 0; index < 5; index += 1) {
      const response = await byEmail.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: `10.0.0.${index + 1}`,
        payload: { email: 'user@example.ru', password: 'Wrong-Password-2026' },
      });
      expect(response.statusCode).toBe(401);
    }

    const correct = await login(byEmail);
    expect(correct.statusCode).toBe(200);
  });

  it('отклоняет небезопасные методы с чужого Origin', async () => {
    const h = await harness();

    const evil = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'https://evil.example' },
      payload: { email: 'user@example.ru', password: PASSWORD },
    });
    expect(evil.statusCode).toBe(403);
    expect(evil.json()).toMatchObject({ code: 'origin_not_allowed' });

    const crossSite = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'sec-fetch-site': 'cross-site' },
      payload: { email: 'user@example.ru', password: PASSWORD },
    });
    expect(crossSite.statusCode).toBe(403);

    const allowed = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'http://localhost:5173' },
      payload: { email: 'user@example.ru', password: PASSWORD },
    });
    expect(allowed.statusCode).toBe(401);

    const health = await h.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(health.statusCode).toBe(200);
  });

  it('не пишет пароль, токены и email в логи', async () => {
    const lines: string[] = [];
    const destination = {
      write(line: string) {
        lines.push(line);
      },
    };
    const logger = createLogger('info', false, destination);
    const h = await harness({ logger });

    const loginResponse = await registerVerifyLogin(h, 'log-test@example.ru');
    const refresh = cookieValue(loginResponse, REFRESH_COOKIE);
    const access = cookieValue(loginResponse, ACCESS_COOKIE);

    await new Promise((resolve) => setImmediate(resolve));
    const output = lines.join('\n');

    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain('log-test@example.ru');
    expect(output).not.toContain(refresh ?? '__none__');
    expect(output).not.toContain(access ?? '__none__');
  });
});
