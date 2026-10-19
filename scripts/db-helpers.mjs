import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
const migrationsDir = fileURLToPath(new URL('../db/migrations', import.meta.url));

export { migrationsDir };

function loadEnv() {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

export function databaseUrl(options = {}) {
  loadEnv();
  const url = options.test ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
  if (!url?.trim()) {
    const name = options.test ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
    throw new Error(`${name} не задан. Проверьте .env (см. .env.example).`);
  }
  return url.trim();
}

export function hasFlag(name) {
  return process.argv.slice(2).includes(name);
}

export function databaseName(url) {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

export function assertTestDatabase(url) {
  const name = databaseName(url);
  if (!name.endsWith('_test')) {
    throw new Error(
      `Отказ: ${name} не похожа на тестовую базу (ожидается суффикс _test). Проверьте DATABASE_URL_TEST.`,
    );
  }
  return name;
}

export function parseCount() {
  const arg = process.argv.slice(2).find((value) => value.startsWith('--count='));
  if (!arg) return Infinity;
  const count = Number(arg.slice('--count='.length));
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('--count должен быть целым положительным числом');
  }
  return count;
}
