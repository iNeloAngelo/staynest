import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import { AppError } from '../../platform/http/errors';
import { createLogger } from '../../platform/logger/index';

const config: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'silent',
  databaseUrl: 'postgres://unused',
  corsOrigins: ['http://localhost:5173'],
  trustProxy: false,
  dbQueryTimeoutMs: 5000,
  webAppUrl: 'http://localhost:5173',
  listingTimeZone: 'Europe/Moscow',
  auth: {
    jwtSecret: 'test-secret-with-at-least-32-characters',
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

const logger = createLogger('silent', false);

function dbWith(status: 'up' | 'down'): Db {
  return {
    check: async () => status,
    pool: {} as Db['pool'],
    kysely: {} as Db['kysely'],
    close: async () => undefined,
  };
}

async function appWithDb(status: 'up' | 'down') {
  return buildApp({ config, logger, db: dbWith(status) });
}

describe('Приватные ответы API', () => {
  it('ставит private, no-store на /me и не меняет no-store у health', async () => {
    const app = await appWithDb('up');

    const me = await app.inject({ method: 'GET', url: '/api/v1/me' });
    const health = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(me.headers['cache-control']).toBe('private, no-store');
    expect(health.headers['cache-control']).toBe('no-store');

    await app.close();
  });
});

describe('GET /api/v1/health', () => {
  it('возвращает ok, когда база доступна', async () => {
    const app = await appWithDb('up');

    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({ status: 'ok', db: 'up' });

    await app.close();
  });

  it('возвращает 503, когда база недоступна', async () => {
    const app = await appWithDb('down');

    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: 'degraded', db: 'down' });

    await app.close();
  });

  it('отдаёт problem+json на неизвестный маршрут', async () => {
    const app = await appWithDb('up');

    const response = await app.inject({ method: 'GET', url: '/api/v1/missing' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ status: 404, code: 'not_found' });

    await app.close();
  });

  it('не раскрывает внутреннюю ошибку в 500', async () => {
    const app = await appWithDb('up');
    app.get('/boom', async () => {
      throw new Error('secret internal detail');
    });

    const response = await app.inject({ method: 'GET', url: '/boom' });
    const body = response.json() as Record<string, unknown>;

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(body).toMatchObject({ status: 500, code: 'internal_error' });
    expect(JSON.stringify(body)).not.toContain('secret internal detail');

    await app.close();
  });

  it('не отдаёт публичный Cache-Control вместе с ошибкой', async () => {
    const app = await appWithDb('up');
    app.get('/public-error', async (_request, reply) => {
      reply.header('cache-control', 'public, max-age=60');
      throw new AppError({
        status: 404,
        code: 'listing_not_found',
        title: 'Not Found',
        detail: 'Объявление не найдено.',
      });
    });

    const response = await app.inject({ method: 'GET', url: '/public-error' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');

    await app.close();
  });

  it('отдаёт код и безопасный текст для AppError', async () => {
    const app = await appWithDb('up');
    app.get('/conflict', async () => {
      throw new AppError({
        status: 409,
        code: 'booking_dates_unavailable',
        title: 'Conflict',
        detail: 'Эти даты уже заняты.',
      });
    });

    const response = await app.inject({ method: 'GET', url: '/conflict' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      status: 409,
      code: 'booking_dates_unavailable',
      detail: 'Эти даты уже заняты.',
    });

    await app.close();
  });

  it('отдаёт problem+json на битый JSON', async () => {
    const app = await appWithDb('up');
    app.post('/echo', async (request) => request.body);

    const response = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"broken":',
    });
    const body = response.json() as Record<string, unknown>;

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(body).toMatchObject({ status: 400, code: 'bad_request' });
    expect(JSON.stringify(body)).not.toContain('Unexpected');

    await app.close();
  });

  it('сохраняет errors[] при ошибке валидации схемы', async () => {
    const app = await appWithDb('up');
    app.post(
      '/validate',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string' } },
          },
        },
      },
      async (request) => request.body,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/validate',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    const body = response.json() as { errors?: unknown };

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(Array.isArray(body.errors)).toBe(true);

    await app.close();
  });

  it('отдаёт problem+json на слишком большое тело', async () => {
    const app = await appWithDb('up');
    app.post('/echo', async (request) => request.body);

    const response = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ data: 'x'.repeat(1024 * 1024) }),
    });

    expect(response.statusCode).toBe(413);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ status: 413, code: 'payload_too_large' });

    await app.close();
  });
});
