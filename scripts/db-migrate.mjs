import { runner } from 'node-pg-migrate';
import {
  assertTestDatabase,
  databaseUrl,
  hasFlag,
  migrationsDir,
  parseCount,
} from './db-helpers.mjs';

const direction = process.argv[2] === 'down' ? 'down' : 'up';
const isTest = hasFlag('--test');
const url = databaseUrl({ test: isTest });
if (isTest) assertTestDatabase(url);
const count = direction === 'down' ? parseCount() : Infinity;
const migrations = await runner({
  databaseUrl: url,
  dir: migrationsDir,
  direction,
  count,
  migrationsTable: 'pgmigrations',
  log: (message) => console.log(message),
});

console.log(`Готово: ${direction}, миграций применено: ${migrations.length}`);
