import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const DEV_JWT_SECRET = 'dev-only-jwt-secret-change-me-before-production';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3100),
  LOG_LEVEL: logLevelSchema.default('info'),
  DATABASE_URL: z.string().min(1).default('postgres://staynest:staynest@localhost:5433/staynest'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  DB_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(5000),

  APP_WEB_URL: z.string().url().default('http://localhost:5173'),
  REQUIRE_EMAIL_VERIFICATION: z.enum(['true', 'false']).default('true'),

  JWT_SECRET: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19_456).max(1_048_576).default(19_456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).max(10).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(16).default(1),

  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().max(65_535).default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(3).default('StayNest <no-reply@staynest.local>'),
});

type LogLevel = z.infer<typeof logLevelSchema>;

export type Argon2Config = {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
};

type AuthConfig = {
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  requireEmailVerification: boolean;
  argon2: Argon2Config;
};

export type MailConfig = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
};

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: LogLevel;
  databaseUrl: string;
  corsOrigins: string[];
  trustProxy: boolean;
  dbQueryTimeoutMs: number;
  webAppUrl: string;
  auth: AuthConfig;
  mail: MailConfig;
};

function loadDotEnvFiles(): void {
  for (const file of ['.env', '../../.env']) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) loadEnvFile(path);
  }
}

function requireInProduction(env: NodeJS.ProcessEnv, keys: string[]): void {
  const missing = keys.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`В production обязательны переменные окружения: ${missing.join(', ')}`);
  }
}

function optionalSecret(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

type EnvData = z.infer<typeof envSchema>;

function assertProductionConfig(env: NodeJS.ProcessEnv, data: EnvData): void {
  if (data.NODE_ENV !== 'production') return;

  requireInProduction(env, [
    'DATABASE_URL',
    'CORS_ORIGINS',
    'JWT_SECRET',
    'SMTP_HOST',
    'APP_WEB_URL',
  ]);

  if (data.JWT_SECRET?.trim().startsWith('dev-only-')) {
    throw new Error('JWT_SECRET не должен совпадать с dev-значением: задайте случайный секрет.');
  }

  const origins = data.CORS_ORIGINS.split(',').map((origin) => origin.trim());
  if (origins.some((origin) => /localhost|127\.0\.0\.1/.test(origin))) {
    throw new Error('CORS_ORIGINS в production не должен содержать localhost.');
  }
  if (/localhost|127\.0\.0\.1/.test(data.APP_WEB_URL)) {
    throw new Error('APP_WEB_URL в production не должен содержать localhost.');
  }
  if (data.REQUIRE_EMAIL_VERIFICATION !== 'true') {
    throw new Error('В production REQUIRE_EMAIL_VERIFICATION должен быть true.');
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env === process.env) loadDotEnvFiles();

  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Некорректная конфигурация окружения: ${details}`);
  }

  const data = parsed.data;
  assertProductionConfig(env, data);

  return {
    nodeEnv: data.NODE_ENV,
    host: data.API_HOST,
    port: data.API_PORT,
    logLevel: data.LOG_LEVEL,
    databaseUrl: data.DATABASE_URL,
    corsOrigins: data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    trustProxy: data.TRUST_PROXY === 'true',
    dbQueryTimeoutMs: data.DB_QUERY_TIMEOUT_MS,
    webAppUrl: data.APP_WEB_URL.replace(/\/+$/, ''),
    auth: {
      jwtSecret: data.JWT_SECRET?.trim() || DEV_JWT_SECRET,
      accessTokenTtlSeconds: data.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlDays: data.REFRESH_TOKEN_TTL_DAYS,
      requireEmailVerification: data.REQUIRE_EMAIL_VERIFICATION === 'true',
      argon2: {
        memoryCost: data.ARGON2_MEMORY_KIB,
        timeCost: data.ARGON2_TIME_COST,
        parallelism: data.ARGON2_PARALLELISM,
      },
    },
    mail: {
      host: data.SMTP_HOST,
      port: data.SMTP_PORT,
      user: optionalSecret(data.SMTP_USER),
      password: optionalSecret(data.SMTP_PASSWORD),
      from: data.MAIL_FROM,
    },
  };
}
