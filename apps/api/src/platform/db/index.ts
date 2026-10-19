import type { Logger } from 'pino';
import { Pool } from 'pg';
import { errorCode } from '../errors/code';

type DbStatus = 'up' | 'down';

export type Db = {
  pool: Pool;
  check: () => Promise<DbStatus>;
  close: () => Promise<void>;
};

export function createDb(connectionString: string, logger: Logger): Db {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30_000,
    query_timeout: 2000,
    statement_timeout: 2000,
  });

  pool.on('error', (error) => {
    logger.error({ code: errorCode(error) }, 'postgres idle client error');
  });

  return {
    pool,
    async check() {
      try {
        await pool.query('select 1');
        return 'up';
      } catch (error) {
        logger.warn({ code: errorCode(error) }, 'postgres health check failed');
        return 'down';
      }
    },
    async close() {
      await pool.end();
    },
  };
}
