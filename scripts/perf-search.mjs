import { Client } from 'pg';
import { databaseUrl } from './db-helpers.mjs';

/**
 * Замеры поиска по датам на перф-данных (Сессия 10).
 * Запускать после `pnpm seed:perf`:
 *
 *   pnpm perf:search
 *
 * Скрипт печатает `EXPLAIN (ANALYZE, BUFFERS)` и p50/p95 прямого SQL-запроса.
 * HTTP-замер end-to-end — `pnpm perf:http` при запущенном API.
 */

const STAY = "daterange(current_date + 30, current_date + 37, '[)')";
const BLOCK_STAY = "daterange(current_date + 16, current_date + 23, '[)')";

const BUSY = `WITH busy AS MATERIALIZED (
  SELECT listing_id FROM bookings
   WHERE status IN ('pending', 'confirmed') AND stay_range && ${STAY}
  UNION
  SELECT listing_id FROM listing_blocks
   WHERE block_range && ${STAY}
)`;

const BLOCK_BUSY = `WITH busy AS MATERIALIZED (
  SELECT listing_id FROM bookings
   WHERE status IN ('pending', 'confirmed') AND stay_range && ${BLOCK_STAY}
  UNION
  SELECT listing_id FROM listing_blocks
   WHERE block_range && ${BLOCK_STAY}
)`;

const AVAILABILITY = `
  AND NOT EXISTS (SELECT 1 FROM busy WHERE busy.listing_id = listings.id)`;

const SCENARIOS = [
  {
    name: 'newest + свободные даты',
    sql: `${BUSY}
           SELECT listings.*, 0::float8 AS rank
            FROM listings
           WHERE listings.status = 'published'
             AND listings.published_at IS NOT NULL
             ${AVAILABILITY}
           ORDER BY listings.published_at DESC, listings.id DESC
           LIMIT 25`,
  },
  {
    name: 'price_asc + город + свободные даты',
    sql: `${BUSY}
           SELECT listings.*, 0::float8 AS rank
            FROM listings
           WHERE listings.status = 'published'
             AND listings.published_at IS NOT NULL
             AND lower(listings.city) = lower('Суздаль')
             ${AVAILABILITY}
           ORDER BY listings.base_price_minor ASC, listings.id ASC
           LIMIT 25`,
  },
  {
    name: 'relevance + q + свободные даты',
    sql: `${BUSY}
           SELECT listings.*, ranked.rank
            FROM (
              SELECT listings.id,
                     ts_rank_cd(listings.search_tsv, websearch_to_tsquery('russian', 'озеро'))::float8 AS rank,
                     to_char(listings.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS published_at_precise
                FROM listings
               WHERE listings.status = 'published'
                 AND listings.published_at IS NOT NULL
                 AND listings.search_tsv @@ websearch_to_tsquery('russian', 'озеро')
                 ${AVAILABILITY}
               ORDER BY rank DESC, listings.published_at DESC, listings.id DESC
               LIMIT 25
            ) AS ranked
            JOIN listings ON listings.id = ranked.id
           ORDER BY ranked.rank DESC, listings.published_at DESC, listings.id DESC`,
  },
  {
    name: 'newest + заблокированные даты',
    sql: `${BLOCK_BUSY}
           SELECT listings.*, 0::float8 AS rank
            FROM listings
           WHERE listings.status = 'published'
             AND listings.published_at IS NOT NULL
             ${AVAILABILITY}
           ORDER BY listings.published_at DESC, listings.id DESC
           LIMIT 25`,
  },
  {
    name: 'гости + цена + тип + свободные даты',
    sql: `${BUSY}
           SELECT listings.*, 0::float8 AS rank
            FROM listings
           WHERE listings.status = 'published'
             AND listings.published_at IS NOT NULL
             AND listings.max_guests >= 6
             AND listings.base_price_minor BETWEEN 300000 AND 1200000
             AND listings.type IN ('house', 'villa')
             ${AVAILABILITY}
           ORDER BY listings.base_price_minor ASC, listings.id ASC
           LIMIT 25`,
  },
];

function percentile(values, p) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function ms(value) {
  return `${value.toFixed(1)} мс`;
}

const repeatArg = process.argv.find((value) => value.startsWith('--repeat='));
const repeat = repeatArg ? Number(repeatArg.slice('--repeat='.length)) : 30;

const client = new Client({ connectionString: databaseUrl() });
await client.connect();

try {
  const counts = await client.query(
    `SELECT
       (SELECT count(*) FROM listings WHERE status = 'published')::int AS listings,
       (SELECT count(*) FROM bookings WHERE status IN ('pending','confirmed'))::int AS active_bookings,
       (SELECT count(*) FROM listing_blocks)::int AS blocks,
       (SELECT count(*) FROM listing_price_rules)::int AS rules`,
  );
  console.log('Данные:', counts.rows[0]);
  console.log('Диапазон:', STAY, 'итераций:', repeat);

  for (const scenario of SCENARIOS) {
    console.log(`\n=== ${scenario.name} ===`);
    const plan = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${scenario.sql}`);
    console.log(plan.rows.map((row) => row['QUERY PLAN']).join('\n'));

    for (let index = 0; index < 3; index += 1) await client.query(scenario.sql);
    const timings = [];
    for (let index = 0; index < repeat; index += 1) {
      const started = performance.now();
      const result = await client.query(scenario.sql);
      timings.push(performance.now() - started);
      if (index === 0) console.log('Строк в выдаче:', result.rows.length);
    }

    console.log(
      `p50: ${ms(percentile(timings, 50))}, p95: ${ms(percentile(timings, 95))}, max: ${ms(Math.max(...timings))}`,
    );
  }
} finally {
  await client.end();
}
