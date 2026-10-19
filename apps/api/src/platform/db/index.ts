import { Kysely, PostgresDialect, sql } from 'kysely';
import type { Logger } from 'pino';
import { Pool, types } from 'pg';
import { errorCode } from '../errors/code';
import type { DB } from './schema.generated';

type DbStatus = 'up' | 'down';

const DATE_OID = 1082;
const defaultTypeParser = types.getTypeParser.bind(types);

// Даты проживания — строки YYYY-MM-DD без таймзоны. Парсер pg по умолчанию
// превращает DATE в Date и сдвигает день при сериализации (см. LEARNS.md).
function parseDateAsString(value: string): string {
  return value;
}

type AppDatabase = Kysely<DB>;

/** Исполнитель запроса: обычное соединение или транзакция (`Transaction extends Kysely`). */
export type DbExecutor = Kysely<DB>;

export type Db = {
  pool: Pool;
  kysely: AppDatabase;
  check: () => Promise<DbStatus>;
  close: () => Promise<void>;
};

function createKysely(pool: Pool): AppDatabase {
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

export function createDb(connectionString: string, logger: Logger, queryTimeoutMs: number): Db {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30_000,
    query_timeout: queryTimeoutMs,
    statement_timeout: queryTimeoutMs,
    types: {
      getTypeParser(oid, format) {
        if (oid === DATE_OID && format === 'text') return parseDateAsString;
        return defaultTypeParser(oid, format);
      },
    },
  });

  pool.on('error', (error) => {
    logger.error({ code: errorCode(error) }, 'postgres idle client error');
  });

  const kysely = createKysely(pool);

  return {
    pool,
    kysely,
    async check() {
      try {
        await sql`select 1`.execute(kysely);
        return 'up';
      } catch (error) {
        logger.warn({ code: errorCode(error) }, 'postgres health check failed');
        return 'down';
      }
    },
    async close() {
      await kysely.destroy();
    },
  };
}
