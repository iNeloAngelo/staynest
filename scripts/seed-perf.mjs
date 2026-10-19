import { Client } from 'pg';
import { databaseUrl } from './db-helpers.mjs';

/**
 * Перф-данные для каталога (Сессия 10): 10 000 опубликованных объявлений,
 * 100 000 броней, 5 000 блокировок и 3 000 сезонных правил.
 *
 * Скрипт идемпотентен в пределах перф-набора: перед загрузкой удаляет данные
 * пользователя `perf-owner@staynest.local`, не трогая остальную dev-базу.
 *
 *   pnpm seed:perf          # загрузить
 *   pnpm seed:perf --clean  # удалить перф-данные
 */

const LISTINGS = 10_000;
const BOOKINGS = 100_000;
const GUESTS = 1_000;
const BLOCKS = 5_000;
const RULES = 3_000;
const OWNER_EMAIL = 'perf-owner@staynest.local';
const GUEST_PREFIX = 'perf-guest-';

const url = databaseUrl();
const cleanOnly = process.argv.slice(2).includes('--clean');

async function ownerId(client) {
  const existing = await client.query('SELECT id FROM users WHERE email = $1', [OWNER_EMAIL]);
  return existing.rows[0]?.id ?? null;
}

async function cleanup(client) {
  const id = await ownerId(client);
  if (!id) return;

  await client.query(
    `DELETE FROM bookings
      WHERE listing_id IN (SELECT id FROM listings WHERE owner_id = $1)`,
    [id],
  );
  await client.query('DELETE FROM listings WHERE owner_id = $1', [id]);
  await client.query('DELETE FROM users WHERE id = $1', [id]);
  await client.query(
    `DELETE FROM users
      WHERE email LIKE $1
        AND NOT EXISTS (SELECT 1 FROM bookings WHERE guest_id = users.id)`,
    [`${GUEST_PREFIX}%@staynest.local`],
  );
}

async function createOwner(client) {
  const inserted = await client.query(
    `INSERT INTO users (email, display_name, locale, email_verified_at)
     VALUES ($1, 'Perf Owner', 'ru', now())
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [OWNER_EMAIL],
  );
  return inserted.rows[0].id;
}

async function createGuests(client) {
  await client.query(
    `INSERT INTO users (email, display_name, locale, email_verified_at)
     SELECT $1 || g || '@staynest.local', 'Perf Guest ' || g, 'ru', now()
     FROM generate_series(1, $2) AS g
     ON CONFLICT (email) DO NOTHING`,
    [GUEST_PREFIX, GUESTS],
  );
}

async function createListings(client, owner) {
  await client.query(
    `INSERT INTO listings (
       owner_id, status, type, title, description, country, region, city,
       address_line, lat, lng, max_guests, bedrooms, beds, bathrooms, area_sqm,
       base_price_minor, weekend_price_minor, cleaning_fee_minor, currency,
       min_nights, max_nights, house_rules, published_at, created_at, updated_at
     )
     SELECT
       $1,
       'published',
       (ARRAY['house','cottage','cabin','villa','townhouse'])[1 + (g % 5)]::listing_type,
       'Перф-дом ' || g || ' у озера',
       'Просторный тестовый дом для замера производительности каталога. Терраса, камин, вид на лес и место для костра.',
       'RU',
       (ARRAY['Владимирская область','Московская область','Тверская область','Ярославская область'])[1 + (g % 4)],
       (ARRAY['Суздаль','Плёс','Кострома','Тверь','Ярославль','Москва','Владимир','Ростов Великий'])[1 + (g % 8)],
       'ул. Тестовая, ' || (g % 200 + 1),
       (55 + (g % 100) / 100)::numeric(9,6),
       (37 + (g % 100) / 100)::numeric(9,6),
       4 + (g % 7),
       g % 5,
       2 + (g % 6),
       1 + (g % 3),
       40 + (g % 160),
       200000 + (g % 180) * 10000,
       350000 + (g % 120) * 10000,
       (g % 4) * 50000,
       'RUB',
       1 + (g % 3),
       14 + (g % 17),
       'Курить нельзя. Тихий час после 22:00.',
       now() - ((g % 365) || ' days')::interval,
       now() - ((g % 365) || ' days')::interval,
       now()
     FROM generate_series(1, $2) AS g`,
    [owner, LISTINGS],
  );
}

async function createPhotos(client, owner) {
  await client.query(
    `WITH inserted AS (
       INSERT INTO listing_photos (listing_id, storage_prefix, width, height, position, is_cover)
       SELECT id, 'listings/' || id || '/' || gen_random_uuid(), 1000, 750, 0, true
       FROM listings
       WHERE owner_id = $1
       RETURNING id, listing_id
     )
     UPDATE listings
        SET cover_photo_id = inserted.id
       FROM inserted
      WHERE listings.id = inserted.listing_id`,
    [owner],
  );
}

async function createBookings(client, owner) {
  await client.query(
    `WITH numbered AS (
       SELECT id, base_price_minor, cleaning_fee_minor, max_guests,
              row_number() OVER (ORDER BY id) AS rn
       FROM listings
       WHERE owner_id = $1
     ), guests AS (
       SELECT id, row_number() OVER (ORDER BY id) AS rn
       FROM users
       WHERE email LIKE $2
     )
     INSERT INTO bookings (
       listing_id, guest_id, stay_range, guests_count, status,
       total_minor, currency, price_breakdown, expires_at, confirmed_at,
       created_at, updated_at
     )
     SELECT
       n.id,
       gu.id,
       daterange(
         current_date - 180 + (i / 10000) * 36,
         current_date - 180 + (i / 10000) * 36 + nights,
         '[)'
       ),
       LEAST(n.max_guests, 1 + (i % 4)),
       status::booking_status,
       nights * n.base_price_minor + n.cleaning_fee_minor,
       'RUB',
       jsonb_build_object(
         'nights', nights,
         'nightlyTotalMinor', nights * n.base_price_minor,
         'cleaningFeeMinor', n.cleaning_fee_minor,
         'serviceFeeMinor', 0,
         'totalMinor', nights * n.base_price_minor + n.cleaning_fee_minor
       ),
       CASE WHEN status = 'pending' THEN now() + interval '24 hours' END,
       CASE WHEN status = 'confirmed' THEN now() - interval '1 day' END,
       now() - ((i % 300) || ' days')::interval,
       now()
     FROM generate_series(0, $3 - 1) AS i
     CROSS JOIN LATERAL (
       SELECT
         3 + (i % 10) AS nights,
         CASE
           WHEN ((i / 10000) * 13 + i % 20) % 20 < 7  THEN 'confirmed'
           WHEN ((i / 10000) * 13 + i % 20) % 20 < 12 THEN 'pending'
           WHEN ((i / 10000) * 13 + i % 20) % 20 < 15 THEN 'declined'
           WHEN ((i / 10000) * 13 + i % 20) % 20 < 17 THEN 'cancelled_by_guest'
           WHEN ((i / 10000) * 13 + i % 20) % 20 < 19 THEN 'expired'
           ELSE 'completed'
         END AS status
     ) AS calc
     JOIN numbered n ON n.rn = (i % 10000) + 1
     JOIN guests gu ON gu.rn = (i % 1000) + 1`,
    [owner, `${GUEST_PREFIX}%@staynest.local`, BOOKINGS],
  );
}

async function createBlocks(client, owner) {
  await client.query(
    `WITH numbered AS (
       SELECT id, row_number() OVER (ORDER BY id) AS rn
       FROM listings
       WHERE owner_id = $1
     )
     INSERT INTO listing_blocks (listing_id, block_range, reason)
     SELECT
       n.id,
       daterange(
         current_date - 180 + (b % 10) * 36 + 16,
         current_date - 180 + (b % 10) * 36 + 21,
         '[)'
       ),
       'Перф-блокировка'
     FROM generate_series(0, $2 - 1) AS b
     JOIN numbered n ON n.rn = b + 1`,
    [owner, BLOCKS],
  );
}

async function createRules(client, owner) {
  await client.query(
    `WITH numbered AS (
       SELECT id, base_price_minor, row_number() OVER (ORDER BY id) AS rn
       FROM listings
       WHERE owner_id = $1
     )
     INSERT INTO listing_price_rules (
       listing_id, name, date_from, date_to, nightly_price_minor, min_nights, priority
     )
     SELECT
       n.id,
       'Перф-сезон',
       current_date + 30 + (n.rn % 3)::int * 60,
       current_date + 90 + (n.rn % 3)::int * 60,
       n.base_price_minor + 50000,
       NULL,
       0
     FROM numbered n
     WHERE n.rn <= $2`,
    [owner, RULES],
  );
}

const client = new Client({ connectionString: url });
await client.connect();

try {
  if (cleanOnly) {
    await cleanup(client);
    console.log('Перф-данные удалены.');
  } else {
    const started = Date.now();
    await client.query('BEGIN');
    try {
      await cleanup(client);
      const owner = await createOwner(client);
      await createGuests(client);
      await createListings(client, owner);
      await createPhotos(client, owner);
      await createBookings(client, owner);
      await createBlocks(client, owner);
      await createRules(client, owner);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    await client.query(
      'ANALYZE listings; ANALYZE listing_photos; ANALYZE bookings; ANALYZE listing_blocks; ANALYZE listing_price_rules;',
    );

    const counts = await client.query(
      `SELECT
         (SELECT count(*) FROM listings WHERE owner_id = u.id)::int AS listings,
         (SELECT count(*) FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE l.owner_id = u.id)::int AS bookings,
         (SELECT count(*) FROM listing_blocks lb JOIN listings l ON l.id = lb.listing_id WHERE l.owner_id = u.id)::int AS blocks,
         (SELECT count(*) FROM listing_price_rules r JOIN listings l ON l.id = r.listing_id WHERE l.owner_id = u.id)::int AS rules,
         (SELECT count(*) FROM listing_photos p JOIN listings l ON l.id = p.listing_id WHERE l.owner_id = u.id)::int AS photos
       FROM users u
       WHERE u.email = $1`,
      [OWNER_EMAIL],
    );

    console.log('Перф-данные загружены за', ((Date.now() - started) / 1000).toFixed(1), 'с');
    console.log(counts.rows[0]);
  }
} finally {
  await client.end();
}
