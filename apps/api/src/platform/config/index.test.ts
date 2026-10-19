import { describe, expect, it } from 'vitest';
import { loadConfig } from './index';

const baseEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/staynest',
  CORS_ORIGINS: 'https://staynest.example',
};

describe('loadConfig', () => {
  it('разбирает список CORS и флаг trust proxy', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'test',
      CORS_ORIGINS: 'https://a.example, https://b.example',
      TRUST_PROXY: 'true',
    });

    expect(config.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(config.trustProxy).toBe(true);
    expect(config.port).toBe(3100);
    expect(config.nodeEnv).toBe('test');
  });

  it('падает в production без DATABASE_URL', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        CORS_ORIGINS: baseEnv.CORS_ORIGINS,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('падает в production без CORS_ORIGINS', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: baseEnv.DATABASE_URL,
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('падает на неизвестном уровне логов', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'test',
        LOG_LEVEL: 'verbose',
      }),
    ).toThrow(/LOG_LEVEL/);
  });
});
