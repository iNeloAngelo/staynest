import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3100),
  LOG_LEVEL: logLevelSchema.default('info'),
  DATABASE_URL: z.string().min(1).default('postgres://staynest:staynest@localhost:5433/staynest'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});

type LogLevel = z.infer<typeof logLevelSchema>;

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: LogLevel;
  databaseUrl: string;
  corsOrigins: string[];
  trustProxy: boolean;
};

function loadDotEnvFiles(): void {
  for (const file of ['.env', '../../.env']) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) loadEnvFile(path);
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

  if (data.NODE_ENV === 'production') {
    const missing = ['DATABASE_URL', 'CORS_ORIGINS'].filter((key) => !env[key]?.trim());
    if (missing.length > 0) {
      throw new Error(`В production обязательны переменные окружения: ${missing.join(', ')}`);
    }
  }

  return {
    nodeEnv: data.NODE_ENV,
    host: data.API_HOST,
    port: data.API_PORT,
    logLevel: data.LOG_LEVEL,
    databaseUrl: data.DATABASE_URL,
    corsOrigins: data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy: data.TRUST_PROXY === 'true',
  };
}
