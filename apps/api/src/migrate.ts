import { runner } from 'node-pg-migrate';
import { loadConfig } from './platform/config/index';

const config = loadConfig();
const migrationsDir = process.env.MIGRATIONS_DIR ?? '/app/db/migrations';

try {
  const migrations = await runner({
    databaseUrl: config.databaseUrl,
    dir: migrationsDir,
    direction: 'up',
    count: Infinity,
    migrationsTable: 'pgmigrations',
  });

  process.stdout.write(`migrations applied: ${migrations.length}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`migration failed: ${message}\n`);
  process.exit(1);
}
