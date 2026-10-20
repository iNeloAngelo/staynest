import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { hash } from '@node-rs/argon2';
import { encode as encodeBlurhash } from 'blurhash';
import { Client } from 'pg';
import sharp from 'sharp';
import {
  DEMO_PASSWORD,
  demoBlocks,
  demoBookingInputs,
  demoFavorites,
  demoListings,
  demoPriceRules,
  demoUsers,
  GUEST_ID,
  HOST_ID,
} from './data.mjs';

const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const photosDir = fileURLToPath(new URL('../../../../scripts/demo-photos/', import.meta.url));
const cleanOnly = process.argv.slice(2).includes('--clean');

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://staynest:staynest@localhost:5433/staynest';
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'staynest',
    secretAccessKey:
      process.env.S3_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'staynest-minio',
  },
});
const bucket = process.env.S3_BUCKET ?? 'staynest-media';
const photoCache = new Map();

function listingIdFor(index) {
  return `00000000-0000-4000-9000-${String(index + 1).padStart(12, '0')}`;
}

function photoKeysFor(prefix) {
  return ['thumb', 'md', 'lg'].map((variant) => `${prefix}/${variant}.webp`);
}

function publicPolicy() {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadMedia',
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [
          `arn:aws:s3:::${bucket}/listings/*/*/*.webp`,
          `arn:aws:s3:::${bucket}/avatars/*/*.webp`,
        ],
      },
    ],
  });
}

async function ensureStorage() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: publicPolicy() }));
}

async function encodeVariants(input) {
  if (photoCache.has(input)) return photoCache.get(input);

  const buffer = await readFile(`${photosDir}${input}.jpg`);
  const raw = await sharp(buffer, { limitInputPixels: 32_000_000 })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const variant = (size) =>
    sharp(raw.data, {
      raw: {
        width: raw.info.width,
        height: raw.info.height,
        channels: raw.info.channels,
      },
    })
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();

  const small = await sharp(raw.data, {
    raw: { width: raw.info.width, height: raw.info.height, channels: raw.info.channels },
  })
    .resize(32, 32, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const processed = {
    width: raw.info.width,
    height: raw.info.height,
    blurhash: encodeBlurhash(
      new Uint8ClampedArray(small.data),
      small.info.width,
      small.info.height,
      4,
      3,
    ),
    variants: {
      thumb: await variant(400),
      md: await variant(1000),
      lg: await variant(2000),
    },
  };

  photoCache.set(input, processed);
  return processed;
}

async function uploadPhoto(prefix, file) {
  const processed = await encodeVariants(file);
  for (const [variant, body] of Object.entries(processed.variants)) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/${variant}.webp`,
        Body: body,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }
  return processed;
}

async function demoIds(client) {
  const result = await client.query('SELECT id FROM users WHERE email = ANY($1::text[])', [
    demoUsers.map((user) => user.email),
  ]);
  return result.rows.map((row) => row.id);
}

async function cleanup(client) {
  const ids = await demoIds(client);
  if (ids.length === 0) return [];

  const photos = await client.query(
    `SELECT storage_prefix FROM listing_photos
      WHERE listing_id IN (SELECT id FROM listings WHERE owner_id = ANY($1::uuid[]))`,
    [ids],
  );
  const avatars = await client.query(
    'SELECT avatar_key FROM users WHERE id = ANY($1::uuid[]) AND avatar_key IS NOT NULL',
    [ids],
  );

  await client.query(
    `DELETE FROM bookings
      WHERE guest_id = ANY($1::uuid[])
         OR listing_id IN (SELECT id FROM listings WHERE owner_id = ANY($1::uuid[]))`,
    [ids],
  );
  await client.query('DELETE FROM listings WHERE owner_id = ANY($1::uuid[])', [ids]);
  await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);

  return [
    ...photos.rows.flatMap((row) => photoKeysFor(row.storage_prefix)),
    ...avatars.rows.map((row) => row.avatar_key),
  ];
}

/** Удаляем старые объекты только после COMMIT: откат не должен ломать живые фото. */
async function removeObjects(keys) {
  for (let index = 0; index < keys.length; index += 500) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.slice(index, index + 500).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

async function createUsers(client) {
  const passwordHash = await hash(DEMO_PASSWORD, {
    memoryCost: Number(process.env.ARGON2_MEMORY_KIB ?? 19_456),
    timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
  });

  for (const user of demoUsers) {
    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name, phone, locale, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [user.id, user.email, passwordHash, user.displayName, user.phone, user.locale],
    );
  }
}

async function amenityIds(client) {
  const result = await client.query('SELECT id, code FROM amenities');
  return new Map(result.rows.map((row) => [row.code, row.id]));
}

async function insertListing(client, listing, index, amenities) {
  const id = listingIdFor(index);
  await client.query(
    `INSERT INTO listings (
       id, owner_id, status, type, title, description, country, region, city, address_line,
       lat, lng, max_guests, bedrooms, beds, bathrooms, area_sqm,
       base_price_minor, weekend_price_minor, cleaning_fee_minor, currency,
       min_nights, max_nights, house_rules, published_at, created_at, updated_at
     ) VALUES (
       $1, $2, 'published', $3, $4, $5, 'RU', $6, $7, $8,
       $9, $10, $11, $12, $13, $14, $15,
       $16, $17, $18, 'RUB', $19, $20, $21,
       now() - ($22 || ' days')::interval, now() - ($22 || ' days')::interval, now()
     )`,
    [
      id,
      HOST_ID,
      listing.type,
      listing.title,
      listing.description,
      listing.region,
      listing.city,
      listing.address,
      listing.lat,
      listing.lng,
      listing.guests,
      listing.bedrooms,
      listing.beds,
      listing.bathrooms,
      listing.area,
      listing.base * 100,
      listing.weekend * 100,
      listing.cleaning * 100,
      listing.minNights,
      listing.maxNights,
      listing.rules,
      String(index + 1),
    ],
  );

  for (const code of listing.amenities) {
    await client.query('INSERT INTO listing_amenities (listing_id, amenity_id) VALUES ($1, $2)', [
      id,
      amenities.get(code),
    ]);
  }

  let coverId = null;
  for (const [position, file] of listing.photos.entries()) {
    const photoId = randomUUID();
    const prefix = `listings/${id}/${photoId}`;
    const processed = await uploadPhoto(prefix, file);
    await client.query(
      `INSERT INTO listing_photos
         (id, listing_id, storage_prefix, width, height, blurhash, position, is_cover)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        photoId,
        id,
        prefix,
        processed.width,
        processed.height,
        processed.blurhash,
        position,
        position === 0,
      ],
    );
    if (position === 0) coverId = photoId;
  }

  await client.query('UPDATE listings SET cover_photo_id = $1 WHERE id = $2', [coverId, id]);
  return id;
}

async function insertExtras(client) {
  for (const rule of demoPriceRules) {
    await client.query(
      `INSERT INTO listing_price_rules
         (listing_id, name, date_from, date_to, nightly_price_minor, min_nights, priority)
       VALUES ($1, $2, current_date + $3::int, current_date + $4::int, $5, $6, $7)`,
      [
        listingIdFor(rule.listing),
        rule.name,
        rule.from,
        rule.to,
        rule.price * 100,
        rule.minNights,
        rule.priority,
      ],
    );
  }

  for (const block of demoBlocks) {
    await client.query(
      `INSERT INTO listing_blocks (listing_id, block_range, reason)
       VALUES ($1, daterange(current_date + $2::int, current_date + $3::int, '[)'), $4)`,
      [listingIdFor(block.listing), block.from, block.to, block.reason],
    );
  }

  for (const listingIndex of demoFavorites) {
    await client.query('INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)', [
      GUEST_ID,
      listingIdFor(listingIndex),
    ]);
  }
}

function shiftDate(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function eventRows(status, times) {
  if (status === 'pending') return [[GUEST_ID, null, 'pending', times.created]];
  if (status === 'expired') {
    return [
      [GUEST_ID, null, 'pending', times.created],
      [null, 'pending', 'expired', times.expires],
    ];
  }
  if (status === 'completed') {
    return [
      [GUEST_ID, null, 'pending', times.created],
      [HOST_ID, 'pending', 'confirmed', times.confirmed],
      [null, 'confirmed', 'completed', times.completed],
    ];
  }
  if (status === 'cancelled_by_host') {
    return [
      [GUEST_ID, null, 'pending', times.created],
      [HOST_ID, 'pending', 'confirmed', times.confirmed],
      [HOST_ID, 'confirmed', 'cancelled_by_host', times.cancelled],
    ];
  }
  if (status === 'cancelled_by_guest') {
    return [
      [GUEST_ID, null, 'pending', times.created],
      [GUEST_ID, 'pending', 'cancelled_by_guest', times.cancelled],
    ];
  }
  if (status === 'declined') {
    return [
      [GUEST_ID, null, 'pending', times.created],
      [HOST_ID, 'pending', 'declined', times.declined],
    ];
  }
  return [
    [GUEST_ID, null, 'pending', times.created],
    [HOST_ID, 'pending', 'confirmed', times.confirmed],
  ];
}

function bookingTimes(input) {
  const recent = input.status === 'pending' || input.status === 'expired';
  const created = recent
    ? hoursFromNow(input.status === 'pending' ? -2 : -30)
    : shiftDate(input.from, -12);
  const confirmed = ['confirmed', 'completed', 'cancelled_by_host'].includes(input.status)
    ? shiftDate(input.from, -8)
    : null;
  const cancelled = input.status.startsWith('cancelled') ? shiftDate(input.from, -4) : null;
  const declined = input.status === 'declined' ? shiftDate(input.from, -5) : null;
  const completed = input.status === 'completed' ? shiftDate(input.to, 1) : null;
  const expires =
    input.status === 'pending'
      ? hoursFromNow(18)
      : input.status === 'expired'
        ? hoursFromNow(-2)
        : null;

  return { created, confirmed, cancelled, declined, completed, expires };
}

function lastEventTime(times) {
  return (
    times.completed ??
    times.cancelled ??
    times.declined ??
    times.confirmed ??
    times.expires ??
    times.created
  );
}

async function insertBooking(client, input, index) {
  const id = `00000000-0000-4000-a000-${String(index + 1).padStart(12, '0')}`;
  const listingId = listingIdFor(input.listingIndex);
  const cancelled = input.status.startsWith('cancelled');
  const cancelledBy = input.status === 'cancelled_by_host' ? HOST_ID : GUEST_ID;
  const times = bookingTimes(input);

  await client.query(
    `INSERT INTO bookings (
       id, listing_id, guest_id, stay_range, guests_count, status, total_minor, currency,
       price_breakdown, guest_message, host_response, expires_at, confirmed_at,
       cancelled_at, cancelled_by, cancel_reason, created_at, updated_at
     ) VALUES (
       $1, $2, $3, daterange($4::date, $5::date, '[)'), $6, $7::booking_status, $8, 'RUB',
       $9::jsonb, $10, $11, $12::timestamptz, $13::timestamptz,
       $14::timestamptz, $15, $16, $17::timestamptz, $18::timestamptz
     )`,
    [
      id,
      listingId,
      GUEST_ID,
      input.from,
      input.to,
      input.guests,
      input.status,
      input.quote.totalMinor,
      JSON.stringify(input.quote),
      input.message ?? null,
      input.hostResponse ?? null,
      times.expires,
      times.confirmed,
      times.cancelled,
      cancelled ? cancelledBy : null,
      input.reason ?? null,
      times.created,
      lastEventTime(times),
    ],
  );

  for (const [actorId, fromStatus, toStatus, createdAt] of eventRows(input.status, times)) {
    await client.query(
      `INSERT INTO booking_events (booking_id, actor_id, from_status, to_status, created_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz)`,
      [id, actorId, fromStatus, toStatus, createdAt],
    );
  }

  return id;
}

async function insertBookings(client) {
  const ids = [];
  for (const [index, input] of demoBookingInputs.entries()) {
    ids.push(await insertBooking(client, input, index));
  }
  return ids;
}

function notificationPayload(input, bookingId, expiresAt = null) {
  return JSON.stringify({
    bookingId,
    listingId: listingIdFor(input.listingIndex),
    listingTitle: input.listing.title,
    checkIn: input.from,
    checkOut: input.to,
    guestName: 'Алексей Морозов',
    totalMinor: input.quote.totalMinor,
    currency: 'RUB',
    ...(expiresAt ? { expiresAt } : {}),
  });
}

async function insertNotifications(client, bookingIds) {
  const entries = [
    { index: 0, userId: HOST_ID, type: 'booking_requested', read: false },
    { index: 11, userId: HOST_ID, type: 'booking_requested', read: false },
    { index: 1, userId: GUEST_ID, type: 'booking_confirmed', read: false },
    { index: 6, userId: GUEST_ID, type: 'booking_declined', read: true },
    { index: 4, userId: GUEST_ID, type: 'booking_completed', read: true },
  ];

  for (const entry of entries) {
    const input = demoBookingInputs[entry.index];
    await client.query(
      `INSERT INTO notifications (user_id, type, payload, read_at, created_at)
       VALUES ($1, $2, $3::jsonb, ${entry.read ? "now() - interval '1 day'" : 'NULL'}, now() - interval '3 hours')`,
      [entry.userId, entry.type, notificationPayload(input, bookingIds[entry.index])],
    );
  }
}

async function main() {
  await ensureStorage();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  let staleKeys = [];

  try {
    await client.query('BEGIN');
    staleKeys = await cleanup(client);

    if (!cleanOnly) {
      await createUsers(client);
      const amenities = await amenityIds(client);

      for (const [index, listing] of demoListings.entries()) {
        await insertListing(client, listing, index, amenities);
      }

      await insertExtras(client);
      const bookingIds = await insertBookings(client);
      await insertNotifications(client, bookingIds);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  await removeObjects(staleKeys);

  if (cleanOnly) {
    console.log('Демо-данные удалены.');
    return;
  }

  const counts = await countDemoData();
  console.log(`Демо-данные загружены: ${counts.listings} домов, ${counts.bookings} броней.`);
  console.log(`Хозяин: ${demoUsers[0].email}, гость: ${demoUsers[1].email}`);
  console.log(`Пароль: ${DEMO_PASSWORD}`);
}

async function countDemoData() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT
         (SELECT count(*) FROM listings WHERE owner_id = $1)::int AS listings,
         (SELECT count(*) FROM bookings WHERE listing_id IN (SELECT id FROM listings WHERE owner_id = $1))::int AS bookings,
         (SELECT count(*) FROM listing_photos p JOIN listings l ON l.id = p.listing_id WHERE l.owner_id = $1)::int AS photos`,
      [HOST_ID],
    );
    return result.rows[0];
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
