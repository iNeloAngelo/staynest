import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import { createLogger } from '../../platform/logger/index';

const config: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'silent',
  databaseUrl: 'postgres://unused',
  corsOrigins: ['http://localhost:5173'],
};

const logger = createLogger('silent', false);

function dbWith(status: 'up' | 'down'): Db {
  return {
    check: async () => status,
    pool: {} as Db['pool'],
    close: async () => undefined,
  };
}

describe('GET /api/v1/health', () => {
  it('возвращает ok, когда база доступна', async () => {
    const app = await buildApp({ config, logger, db: dbWith('up') });

    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.json()).toMatchObject({ status: 'ok', db: 'up' });

    await app.close();
  });

  it('возвращает 503, когда база недоступна', async () => {
    const app = await buildApp({ config, logger, db: dbWith('down') });

    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: 'degraded', db: 'down' });

    await app.close();
  });

  it('отдаёт problem+json на неизвестный маршрут', async () => {
    const app = await buildApp({ config, logger, db: dbWith('up') });

    const response = await app.inject({ method: 'GET', url: '/api/v1/missing' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ status: 404, code: 'not_found' });

    await app.close();
  });
});
