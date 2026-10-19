import { describe, expect, it } from 'vitest';
import { loadConfig } from './index';

const baseEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/staynest',
  CORS_ORIGINS: 'https://staynest.example',
  JWT_SECRET: 'test-secret-with-at-least-32-characters',
  SMTP_HOST: 'localhost',
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

  it('разбирает настройки авторизации и почты', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'test',
      REQUIRE_EMAIL_VERIFICATION: 'false',
      ACCESS_TOKEN_TTL_SECONDS: '600',
      REFRESH_TOKEN_TTL_DAYS: '7',
      ARGON2_MEMORY_KIB: '32768',
      SMTP_PORT: '2525',
      APP_WEB_URL: 'https://staynest.example/',
    });

    expect(config.auth.requireEmailVerification).toBe(false);
    expect(config.auth.accessTokenTtlSeconds).toBe(600);
    expect(config.auth.refreshTokenTtlDays).toBe(7);
    expect(config.auth.argon2.memoryCost).toBe(32_768);
    expect(config.webAppUrl).toBe('https://staynest.example');
    expect(config.mail.port).toBe(2525);
    expect(config.mail.password).toBeUndefined();
  });

  it('падает в production без DATABASE_URL', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        CORS_ORIGINS: baseEnv.CORS_ORIGINS,
        JWT_SECRET: baseEnv.JWT_SECRET,
        SMTP_HOST: baseEnv.SMTP_HOST,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('падает в production без CORS_ORIGINS', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: baseEnv.DATABASE_URL,
        JWT_SECRET: baseEnv.JWT_SECRET,
        SMTP_HOST: baseEnv.SMTP_HOST,
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('падает в production без JWT_SECRET', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: baseEnv.DATABASE_URL,
        CORS_ORIGINS: baseEnv.CORS_ORIGINS,
        SMTP_HOST: baseEnv.SMTP_HOST,
        APP_WEB_URL: 'https://staynest.example',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('падает в production с dev-значением JWT_SECRET', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: baseEnv.DATABASE_URL,
        CORS_ORIGINS: baseEnv.CORS_ORIGINS,
        JWT_SECRET: 'dev-only-jwt-secret-change-me-before-production',
        SMTP_HOST: baseEnv.SMTP_HOST,
        APP_WEB_URL: 'https://staynest.example',
      }),
    ).toThrow(/dev-значением/);
  });

  it('падает в production с выключенным REQUIRE_EMAIL_VERIFICATION', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: baseEnv.DATABASE_URL,
        CORS_ORIGINS: baseEnv.CORS_ORIGINS,
        JWT_SECRET: baseEnv.JWT_SECRET,
        SMTP_HOST: baseEnv.SMTP_HOST,
        APP_WEB_URL: 'https://staynest.example',
        REQUIRE_EMAIL_VERIFICATION: 'false',
      }),
    ).toThrow(/REQUIRE_EMAIL_VERIFICATION/);
  });

  it('нормализует завершающий слэш в CORS_ORIGINS', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'test',
      CORS_ORIGINS: 'https://staynest.example/',
    });

    expect(config.corsOrigins).toEqual(['https://staynest.example']);
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
