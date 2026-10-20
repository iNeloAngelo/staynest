import { describe, expect, it } from 'vitest';
import { loadConfig } from './index';

const baseEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/staynest',
  CORS_ORIGINS: 'https://staynest.example',
  JWT_SECRET: 'test-secret-with-at-least-32-characters',
  SMTP_HOST: 'localhost',
  APP_WEB_URL: 'https://staynest.example',
  S3_ENDPOINT: 'https://s3.example',
  S3_BUCKET: 'staynest-media',
  S3_SECRET_KEY: 'production-secret',
};

const prodEnv = { ...baseEnv, NODE_ENV: 'production' };

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
      PHOTO_MAX_UPLOAD_BYTES: '5242880',
      MEDIA_PUBLIC_PATH: '/media/',
    });

    expect(config.auth.requireEmailVerification).toBe(false);
    expect(config.auth.accessTokenTtlSeconds).toBe(600);
    expect(config.auth.refreshTokenTtlDays).toBe(7);
    expect(config.auth.argon2.memoryCost).toBe(32_768);
    expect(config.webAppUrl).toBe('https://staynest.example');
    expect(config.mail.port).toBe(2525);
    expect(config.mail.password).toBeUndefined();
    expect(config.storage.maxUploadBytes).toBe(5_242_880);
    expect(config.storage.publicPath).toBe('/media');
    expect(config.storage.bucket).toBe('staynest-media');
  });

  it('падает в production без DATABASE_URL', () => {
    expect(() => loadConfig({ ...prodEnv, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('падает в production без CORS_ORIGINS', () => {
    expect(() => loadConfig({ ...prodEnv, CORS_ORIGINS: '' })).toThrow(/CORS_ORIGINS/);
  });

  it('падает в production без JWT_SECRET', () => {
    expect(() => loadConfig({ ...prodEnv, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
  });

  it('падает в production с dev-значением JWT_SECRET', () => {
    expect(() =>
      loadConfig({
        ...prodEnv,
        JWT_SECRET: 'dev-only-jwt-secret-change-me-before-production',
      }),
    ).toThrow(/dev-значением/);
  });

  it('падает в production с выключенным REQUIRE_EMAIL_VERIFICATION', () => {
    expect(() => loadConfig({ ...prodEnv, REQUIRE_EMAIL_VERIFICATION: 'false' })).toThrow(
      /REQUIRE_EMAIL_VERIFICATION/,
    );
  });

  it('падает в production с dev-паролем хранилища и без S3_ENDPOINT', () => {
    expect(() => loadConfig({ ...prodEnv, S3_SECRET_KEY: 'staynest-minio' })).toThrow(
      /S3_SECRET_KEY/,
    );
    expect(() => loadConfig({ ...prodEnv, S3_ENDPOINT: '' })).toThrow(/S3_ENDPOINT/);
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

  it('включает push только при полной паре VAPID и разбирает окно напоминания', () => {
    const disabled = loadConfig({ ...baseEnv, NODE_ENV: 'test' });
    expect(disabled.push).toMatchObject({ enabled: false, publicKey: null });
    expect(disabled.booking.expiryWarningHours).toBe(3);

    const enabled = loadConfig({
      ...baseEnv,
      NODE_ENV: 'test',
      VAPID_PUBLIC_KEY: 'public-key',
      VAPID_PRIVATE_KEY: 'private-key',
      BOOKING_EXPIRY_WARNING_HOURS: '5',
    });
    expect(enabled.push).toMatchObject({
      enabled: true,
      publicKey: 'public-key',
      privateKey: 'private-key',
    });
    expect(enabled.booking.expiryWarningHours).toBe(5);

    expect(() =>
      loadConfig({ ...baseEnv, NODE_ENV: 'test', VAPID_PUBLIC_KEY: 'public-key' }),
    ).toThrow(/VAPID/);
  });
});
