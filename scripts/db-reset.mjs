import { Client } from 'pg';
import { runner } from 'node-pg-migrate';
import {
  assertTestDatabase,
  databaseName,
  databaseUrl,
  hasFlag,
  migrationsDir,
} from './db-helpers.mjs';

const isTest = hasFlag('--test');
const url = databaseUrl({ test: isTest });
const name = databaseName(url);

if (!/^[A-Za-z0-9_]+$/.test(name)) {
  throw new Error(`Недопустимое имя базы: ${name}`);
}

if (isTest) assertTestDatabase(url);

async function ensureDatabase() {
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${name}"`);
      console.log(`Создана база ${name}`);
      return;
    }

    await client.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [name],
    );
  } finally {
    await client.end();
  }
}

async function resetSchema() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("SET lock_timeout = '5s'");
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');
  } finally {
    await client.end();
  }
}

await ensureDatabase();
await resetSchema();

const migrations = await runner({
  databaseUrl: url,
  dir: migrationsDir,
  direction: 'up',
  count: Infinity,
  migrationsTable: 'pgmigrations',
  log: (message) => console.log(message),
});

console.log(`База ${name} пересоздана, миграций применено: ${migrations.length}`);
