import sharp from 'sharp';
import type { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { UserDto } from '@staynest/shared';
import type { MediaStorage } from '../src/platform/storage/index';
import {
  authHeaders,
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
} from './support/harness';
import type { Harness, TestUser } from './support/harness';

const url = databaseUrl ?? '';

type StoredObject = { body: Buffer; contentType: string };

function memoryStorage() {
  const objects = new Map<string, StoredObject>();

  const storage: MediaStorage = {
    ensureReady: async () => undefined,
    put: async (key, body, contentType) => {
      objects.set(key, { body, contentType });
    },
    remove: async (keys) => {
      for (const key of keys) objects.delete(key);
    },
    publicUrl: (key) => `/media/${key}`,
    close: () => undefined,
  };

  return { storage, objects };
}

function multipart(
  data: Buffer,
  options: { field?: string; filename?: string; type?: string } = {},
) {
  const boundary = `----staynest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${options.field ?? 'avatar'}"; filename="${options.filename ?? 'avatar.jpg'}"\r\n` +
      `Content-Type: ${options.type ?? 'image/jpeg'}\r\n\r\n`,
  );

  return {
    payload: Buffer.concat([header, data, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function image(width = 640, height = 480): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 80, g: 110, b: 90 } },
  })
    .jpeg()
    .toBuffer();
}

describeDatabase('профиль и аватар', () => {
  let client: Client;
  let h: Harness;
  let user: TestUser;
  const media = memoryStorage();

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness({}, media.storage);
    user = await createUser(h, 'user@example.ru', 'Анна');
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  beforeEach(() => {
    media.objects.clear();
  });

  async function upload(data: Buffer, field?: string) {
    const form = multipart(data, field === undefined ? {} : { field });
    return h.app.inject({
      method: 'POST',
      url: '/api/v1/me/avatar',
      headers: {
        ...authHeaders(user.cookie),
        'content-type': form.contentType,
      },
      payload: form.payload,
    });
  }

  it('загружает аватар, отдаёт URL и удаляет прошлый файл', async () => {
    const first = await upload(await image());
    expect(first.statusCode).toBe(200);
    const firstUser = (first.json() as { user: UserDto }).user;
    expect(firstUser.avatarKey).toMatch(new RegExp(`^avatars/${user.id}/[0-9a-f-]+\\.webp$`));
    expect(firstUser.avatarUrl).toBe(`/media/${firstUser.avatarKey}`);
    expect(media.objects.get(firstUser.avatarKey ?? '')?.contentType).toBe('image/webp');

    const second = await upload(await image());
    expect(second.statusCode).toBe(200);
    const secondUser = (second.json() as { user: UserDto }).user;
    expect(secondUser.avatarKey).not.toBe(firstUser.avatarKey);
    expect(media.objects.has(firstUser.avatarKey ?? '')).toBe(false);
    expect(media.objects.size).toBe(1);
  });

  it('не принимает файл, который только притворяется картинкой', async () => {
    const response = await upload(Buffer.from('MZ not an image at all'), 'avatar');

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({ code: 'avatar_unsupported' });
    expect(media.objects.size).toBe(0);
  });

  it('требует поле avatar', async () => {
    const response = await upload(await image(), 'file');
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'avatar_required' });
  });

  it('отклоняет файл больше 5 МБ', async () => {
    const response = await upload(Buffer.alloc(6 * 1024 * 1024, 1));
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'avatar_too_large' });
    expect(media.objects.size).toBe(0);
  });

  it('удаляет аватар вместе с объектом в хранилище', async () => {
    const uploaded = await upload(await image());
    const key = (uploaded.json() as { user: UserDto }).user.avatarKey ?? '';

    const removed = await h.app.inject({
      method: 'DELETE',
      url: '/api/v1/me/avatar',
      headers: authHeaders(user.cookie),
    });

    expect(removed.statusCode).toBe(200);
    expect((removed.json() as { user: UserDto }).user.avatarUrl).toBeNull();
    expect(media.objects.has(key)).toBe(false);
  });

  it('сохраняет имя, телефон и язык через PATCH /me', async () => {
    const response = await h.app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: authHeaders(user.cookie),
      payload: { displayName: 'Анна Лесная', phone: '+7 900 000-00-00', locale: 'en' },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { user: UserDto }).user).toMatchObject({
      displayName: 'Анна Лесная',
      phone: '+7 900 000-00-00',
      locale: 'en',
    });
  });

  it('без авторизации аватар не загрузить', async () => {
    const form = multipart(await image());
    const response = await h.app.inject({
      method: 'POST',
      url: '/api/v1/me/avatar',
      headers: { 'content-type': form.contentType },
      payload: form.payload,
    });

    expect(response.statusCode).toBe(401);
  });
});
