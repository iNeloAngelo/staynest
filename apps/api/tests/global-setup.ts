import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
const LOCK_KEY = 724_512_345;

/**
 * Сериализует прогоны интеграционных тестов между процессами: тесты делают
 * DROP SCHEMA и не должны конкурировать за одну тестовую базу. Блокировка
 * держится на отдельном соединении до конца прогона.
 */
export default async function setup(): Promise<(() => Promise<void>) | undefined> {
  if (!process.env.DATABASE_URL_TEST && existsSync(envFile)) process.loadEnvFile(envFile);

  const url = process.env.DATABASE_URL_TEST?.trim();
  if (!url) return undefined;

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);

  return async () => {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    await client.end();
  };
}
