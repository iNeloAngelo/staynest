import { Pool } from 'pg';

type DbStatus = 'up' | 'down';

export type Db = {
  pool: Pool;
  check: () => Promise<DbStatus>;
  close: () => Promise<void>;
};

export function createDb(connectionString: string): Db {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30_000,
  });

  return {
    pool,
    async check() {
      try {
        await pool.query('select 1');
        return 'up';
      } catch {
        return 'down';
      }
    },
    async close() {
      await pool.end();
    },
  };
}
