import sharp from 'sharp';
import type { Client } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { ListingPhotoDto } from '@staynest/shared';
import {
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
} from './support/harness';
import type { Harness, TestUser } from './support/harness';
import type { MediaStorage } from '../src/platform/storage/index';

const url = databaseUrl ?? '';
const activeHarnesses: Harness[] = [];
const MB = 1024 * 1024;

type MemoryStorage = {
  storage: MediaStorage;
  objects: Map<string, { body: Buffer; contentType: string }>;
};

function memoryStorage(failPut?: (key: string) => boolean): MemoryStorage {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  let failed = false;

  return {
    objects,
    storage: {
      ensureReady: async () => undefined,
      put: async (key, body, contentType) => {
        if (!failed && failPut?.(key)) {
          failed = true;
          throw new Error('storage is down');
        }
        objects.set(key, { body, contentType });
      },
      remove: async (keys) => {
        for (const key of keys) objects.delete(key);
      },
      publicUrl: (key) => `/media/${key}`,
      close: () => undefined,
    },
  };
}

async function jpeg(width = 640, height = 480): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 90, g: 120, b: 90 } },
  })
    .jpeg()
    .toBuffer();
}

type UploadFile = { name: string; data: Buffer; type?: string };

function multipart(files: UploadFile[]): { payload: Buffer; contentType: string } {
  const boundary = `----staynest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${file.name}"\r\n` +
          `Content-Type: ${file.type ?? 'image/jpeg'}\r\n\r\n`,
      ),
      file.data,
      Buffer.from('\r\n'),
    );
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    payload: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function setup(options?: {
  maxPerListing?: number;
  maxUploadBytes?: number;
  maxPixels?: number;
  failPut?: (key: string) => boolean;
}): Promise<{
  h: Harness;
  owner: TestUser;
  stranger: TestUser;
  listingId: string;
  media: MemoryStorage;
}> {
  const media = memoryStorage(options?.failPut);
  const h = await createHarness(
    options
      ? {
          storage: {
            endpoint: 'http://localhost:9000',
            region: 'us-east-1',
            bucket: 'staynest-media',
            accessKey: 'test',
            secretKey: 'test-secret',
            publicPath: '/media',
            maxUploadBytes: options.maxUploadBytes ?? 10 * MB,
            maxPerListing: options.maxPerListing ?? 20,
            maxPixels: options.maxPixels ?? 32_000_000,
          },
        }
      : {},
    media.storage,
  );
  activeHarnesses.push(h);

  const owner = await createUser(h, 'owner@example.ru', 'Хозяин');
  const stranger = await createUser(h, 'stranger@example.ru', 'Посторонний');

  const created = await h.app.inject({
    method: 'POST',
    url: '/api/v1/listings',
    headers: { cookie: owner.cookie },
  });
  const listingId = (created.json() as { listing: { id: string } }).listing.id;

  return { h, owner, stranger, listingId, media };
}

async function upload(h: Harness, user: TestUser, listingId: string, files: UploadFile[]) {
  const form = multipart(files);

  return h.app.inject({
    method: 'POST',
    url: `/api/v1/listings/${listingId}/photos`,
    headers: { cookie: user.cookie, 'content-type': form.contentType },
    payload: form.payload,
  });
}

async function photoOf(name = 'house.jpg'): Promise<UploadFile> {
  return { name, data: await jpeg() };
}

function photosFrom(response: { json: () => unknown }): ListingPhotoDto[] {
  return (response.json() as { photos: ListingPhotoDto[] }).photos;
}

describeDatabase('photos API', () => {
  let client: Client;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE users RESTART IDENTITY CASCADE');
  });

  afterEach(async () => {
    for (const h of activeHarnesses.splice(0)) {
      await h.app.close();
      await h.db.close();
    }
  });

  it('загружает фото, делает обложкой первое и отдаёт три URL', async () => {
    const { h, owner, listingId, media } = await setup();

    const response = await upload(h, owner, listingId, [
      await photoOf('a.jpg'),
      await photoOf('b.jpg'),
    ]);
    const photos = photosFrom(response);

    expect(response.statusCode).toBe(201);
    expect(photos).toHaveLength(2);
    expect(photos.map((photo) => photo.position)).toEqual([0, 1]);
    expect(photos.map((photo) => photo.isCover)).toEqual([true, false]);
    expect(photos[0]?.width).toBe(640);
    expect(photos[0]?.height).toBe(480);
    expect(photos[0]?.blurhash).toBeTruthy();
    expect(photos[0]?.urls).toEqual({
      thumb: `/media/listings/${listingId}/${photos[0]?.id}/thumb.webp`,
      md: `/media/listings/${listingId}/${photos[0]?.id}/md.webp`,
      lg: `/media/listings/${listingId}/${photos[0]?.id}/lg.webp`,
    });
    expect(media.objects.size).toBe(6);
    expect([...media.objects.values()].every((item) => item.contentType === 'image/webp')).toBe(
      true,
    );

    const listing = await h.db.kysely
      .selectFrom('listings')
      .select(['cover_photo_id'])
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(listing.cover_photo_id).toBe(photos[0]?.id);

    const mine = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: owner.cookie },
    });
    const listed = (mine.json() as { listings: Array<{ photos: ListingPhotoDto[] }> }).listings[0];
    expect(listed?.photos.map((photo) => photo.id)).toEqual(photos.map((photo) => photo.id));
  });

  it('отвергает exe, переименованный в jpg, и ничего не пишет', async () => {
    const { h, owner, listingId, media } = await setup();
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(1024, 0)]);

    const response = await upload(h, owner, listingId, [{ name: 'photo.jpg', data: exe }]);

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({ code: 'photo_unsupported_type' });
    expect(media.objects.size).toBe(0);
    const count = await h.db.kysely
      .selectFrom('listing_photos')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    expect(count.count).toBe('0');
  });

  it('отвергает файл больше лимита с кодом photo_too_large', async () => {
    const { h, owner, listingId, media } = await setup({ maxUploadBytes: MB });

    const response = await upload(h, owner, listingId, [
      { name: 'huge.jpg', data: Buffer.alloc(MB + 1024, 1) },
    ]);

    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ code: 'photo_too_large' });
    expect(media.objects.size).toBe(0);
  });

  it('не превышает потолок фото объявления и чистит уже загруженное', async () => {
    const { h, owner, listingId, media } = await setup({ maxPerListing: 2 });

    const response = await upload(h, owner, listingId, [
      await photoOf('a.jpg'),
      await photoOf('b.jpg'),
      await photoOf('c.jpg'),
    ]);

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'photos_limit_reached' });
    expect(media.objects.size).toBe(0);

    const count = await h.db.kysely
      .selectFrom('listing_photos')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    expect(count.count).toBe('0');
  });

  it('меняет порядок и обложку', async () => {
    const { h, owner, listingId } = await setup();
    const uploaded = photosFrom(
      await upload(h, owner, listingId, [await photoOf(), await photoOf(), await photoOf()]),
    );
    const ids = uploaded.map((photo) => photo.id);

    const reordered = await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}/photos/order`,
      headers: { cookie: owner.cookie },
      payload: { photoIds: [ids[2], ids[0], ids[1]] },
    });
    expect(reordered.statusCode).toBe(200);
    expect(photosFrom(reordered).map((photo) => photo.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(photosFrom(reordered).map((photo) => photo.position)).toEqual([0, 1, 2]);
    expect(photosFrom(reordered).map((photo) => photo.isCover)).toEqual([false, true, false]);

    const covered = await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}/photos/${ids[2]}/cover`,
      headers: { cookie: owner.cookie },
    });
    expect(covered.statusCode).toBe(200);
    expect(photosFrom(covered).find((photo) => photo.isCover)?.id).toBe(ids[2]);

    const row = await h.db.kysely
      .selectFrom('listings')
      .select('cover_photo_id')
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(row.cover_photo_id).toBe(ids[2]);
  });

  it('отвергает неполный или чужой порядок', async () => {
    const { h, owner, listingId } = await setup();
    const uploaded = photosFrom(
      await upload(h, owner, listingId, [await photoOf(), await photoOf()]),
    );

    const incomplete = await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}/photos/order`,
      headers: { cookie: owner.cookie },
      payload: { photoIds: [uploaded[0]?.id] },
    });
    const duplicate = await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}/photos/order`,
      headers: { cookie: owner.cookie },
      payload: { photoIds: [uploaded[0]?.id, uploaded[0]?.id] },
    });

    expect(incomplete.statusCode).toBe(422);
    expect(incomplete.json()).toMatchObject({ code: 'photo_order_invalid' });
    expect(duplicate.statusCode).toBe(422);
  });

  it('удаляет фото из БД и хранилища, передавая обложку следующему', async () => {
    const { h, owner, listingId, media } = await setup();
    const uploaded = photosFrom(
      await upload(h, owner, listingId, [await photoOf(), await photoOf()]),
    );
    const [first, second] = uploaded;
    if (!first || !second) throw new Error('нет фото');

    const response = await h.app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listingId}/photos/${first.id}`,
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(204);
    expect(media.objects.size).toBe(3);
    expect([...media.objects.keys()].some((key) => key.includes(first.id))).toBe(false);

    const row = await h.db.kysely
      .selectFrom('listings')
      .select('cover_photo_id')
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(row.cover_photo_id).toBe(second.id);

    const repeated = await h.app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listingId}/photos/${first.id}`,
      headers: { cookie: owner.cookie },
    });
    expect(repeated.statusCode).toBe(404);
  });

  it('чистит хранилище при удалении черновика с фото', async () => {
    const { h, owner, listingId, media } = await setup();
    await upload(h, owner, listingId, [await photoOf()]);
    expect(media.objects.size).toBe(3);

    const response = await h.app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listingId}`,
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(204);
    expect(media.objects.size).toBe(0);
  });

  it('не даёт трогать фото чужого объявления', async () => {
    const { h, owner, stranger, listingId, media } = await setup();
    const uploaded = photosFrom(await upload(h, owner, listingId, [await photoOf()]));
    const photoId = uploaded[0]?.id ?? '';

    const actions = await Promise.all([
      upload(h, stranger, listingId, [await photoOf()]),
      h.app.inject({
        method: 'PATCH',
        url: `/api/v1/listings/${listingId}/photos/order`,
        headers: { cookie: stranger.cookie },
        payload: { photoIds: [photoId] },
      }),
      h.app.inject({
        method: 'PATCH',
        url: `/api/v1/listings/${listingId}/photos/${photoId}/cover`,
        headers: { cookie: stranger.cookie },
      }),
      h.app.inject({
        method: 'DELETE',
        url: `/api/v1/listings/${listingId}/photos/${photoId}`,
        headers: { cookie: stranger.cookie },
      }),
    ]);

    for (const response of actions) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'listing_not_found' });
    }

    expect(media.objects.size).toBe(3);
    const count = await h.db.kysely
      .selectFrom('listing_photos')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    expect(count.count).toBe('1');
  });

  it('не принимает больше 10 файлов за запрос', async () => {
    const { h, owner, listingId, media } = await setup();
    const files = await Promise.all(
      Array.from({ length: 11 }, (_, index) => photoOf(`${index}.jpg`)),
    );

    const response = await upload(h, owner, listingId, files);

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'photos_per_upload_limit' });
    expect(media.objects.size).toBe(0);
  });

  it('отвергает изображение больше лимита пикселей без записей', async () => {
    const { h, owner, listingId, media } = await setup({ maxPixels: 1_000_000 });
    const large = { name: 'large.jpg', data: await jpeg(2000, 2000) };

    const response = await upload(h, owner, listingId, [large]);

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'photo_pixels_exceeded' });
    expect(media.objects.size).toBe(0);
  });

  it('не оставляет опубликованное объявление с меньше чем 3 фото', async () => {
    const { h, owner, listingId } = await setup();
    const photos = photosFrom(
      await upload(h, owner, listingId, [await photoOf(), await photoOf(), await photoOf()]),
    );

    await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}`,
      headers: { cookie: owner.cookie },
      payload: {
        title: 'Дом у озера',
        description:
          'Тихий дом с террасой и видом на озеро. Подходит для семьи из четырёх человек, есть камин и лодка.',
        city: 'Суздаль',
        addressLine: 'Лесная улица, 12',
        maxGuests: 4,
        bedrooms: 2,
        beds: 3,
        basePriceMinor: 750_000,
      },
    });
    const published = await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/publish`,
      headers: { cookie: owner.cookie },
    });
    expect(published.statusCode).toBe(200);

    const response = await h.app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listingId}/photos/${photos[2]?.id}`,
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'photos_too_few_published' });

    const count = await h.db.kysely
      .selectFrom('listing_photos')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    expect(count.count).toBe('3');
  });

  it('не откатывает удаление обложки у published, если фото станет меньше 3', async () => {
    const { h, owner, listingId } = await setup();
    const photos = photosFrom(
      await upload(h, owner, listingId, [await photoOf(), await photoOf(), await photoOf()]),
    );
    const coverId = photos.find((photo) => photo.isCover)?.id;

    await h.app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}`,
      headers: { cookie: owner.cookie },
      payload: {
        title: 'Дом у озера',
        description:
          'Тихий дом с террасой и видом на озеро. Подходит для семьи из четырёх человек, есть камин и лодка.',
        city: 'Суздаль',
        addressLine: 'Лесная улица, 12',
        maxGuests: 4,
        bedrooms: 2,
        beds: 3,
        basePriceMinor: 750_000,
      },
    });
    await h.app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/publish`,
      headers: { cookie: owner.cookie },
    });

    const response = await h.app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listingId}/photos/${coverId}`,
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(422);

    const listing = await h.db.kysely
      .selectFrom('listings')
      .select('cover_photo_id')
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(listing.cover_photo_id).toBe(coverId);

    const count = await h.db.kysely
      .selectFrom('listing_photos')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    expect(count.count).toBe('3');
  });

  it('держит потолок фото при параллельных загрузках', async () => {
    const { h, owner, listingId, media } = await setup({ maxPerListing: 3 });
    await upload(h, owner, listingId, [await photoOf(), await photoOf()]);

    const [first, second] = await Promise.all([
      upload(h, owner, listingId, [await photoOf()]),
      upload(h, owner, listingId, [await photoOf()]),
    ]);

    expect([first.statusCode, second.statusCode].sort()).toEqual([201, 422]);
    expect(media.objects.size).toBe(9);

    const rows = await h.db.kysely
      .selectFrom('listing_photos')
      .selectAll()
      .where('listing_id', '=', listingId)
      .execute();
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.is_cover)).toHaveLength(1);
  });

  it('при удалении единственного фото очищает обложку и хранилище', async () => {
    const { h, owner, listingId, media } = await setup();
    const [photo] = photosFrom(await upload(h, owner, listingId, [await photoOf()]));

    const response = await h.app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listingId}/photos/${photo?.id}`,
      headers: { cookie: owner.cookie },
    });

    expect(response.statusCode).toBe(204);
    expect(media.objects.size).toBe(0);

    const row = await h.db.kysely
      .selectFrom('listings')
      .select('cover_photo_id')
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow();
    expect(row.cover_photo_id).toBeNull();
  });

  it('отдаёт 503 при сбое хранилища и убирает уже записанные варианты', async () => {
    const { h, owner, listingId, media } = await setup({
      failPut: (key) => key.endsWith('/md.webp'),
    });

    const response = await upload(h, owner, listingId, [await photoOf()]);

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: 'storage_unavailable' });
    expect(media.objects.size).toBe(0);

    const count = await h.db.kysely
      .selectFrom('listing_photos')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    expect(count.count).toBe('0');
  });

  it('ограничивает частоту загрузок и отдаёт Retry-After', async () => {
    const { h, owner, listingId } = await setup();
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(128, 0)]);

    let last = await upload(h, owner, listingId, [{ name: 'fake.jpg', data: exe }]);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      last = await upload(h, owner, listingId, [{ name: 'fake.jpg', data: exe }]);
    }

    expect(last.statusCode).toBe(429);
    expect(last.json()).toMatchObject({ code: 'photo_upload_rate_limited' });
    expect(last.headers['retry-after']).toBe('600');
  });

  it('закрывает маршруты без авторизации', async () => {
    const { h, listingId } = await setup();
    const photoId = crypto.randomUUID();
    const form = multipart([await photoOf()]);

    const responses = await Promise.all([
      h.app.inject({
        method: 'POST',
        url: `/api/v1/listings/${listingId}/photos`,
        headers: { 'content-type': form.contentType },
        payload: form.payload,
      }),
      h.app.inject({
        method: 'PATCH',
        url: `/api/v1/listings/${listingId}/photos/order`,
        payload: { photoIds: [] },
      }),
      h.app.inject({
        method: 'PATCH',
        url: `/api/v1/listings/${listingId}/photos/${photoId}/cover`,
      }),
      h.app.inject({
        method: 'DELETE',
        url: `/api/v1/listings/${listingId}/photos/${photoId}`,
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });
});
