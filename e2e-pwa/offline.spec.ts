import { expect, request as apiRequest, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const PASSWORD = 'Forest-Lake-2026';
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://staynest:staynest@127.0.0.1:5433/staynest_e2e_test';
const DESCRIPTION =
  'Тихий дом с террасой, камином и видом на сосновый лес. Подходит для семьи из четырёх человек.';

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.ru`;
}

async function registerAndLogin(
  request: APIRequestContext,
  email: string,
  name: string,
): Promise<void> {
  const registered = await request.post('/api/v1/auth/register', {
    data: { email, password: PASSWORD, displayName: name, locale: 'ru' },
  });
  expect(registered.status(), await registered.text()).toBe(202);

  const loggedIn = await request.post('/api/v1/auth/login', {
    data: { email, password: PASSWORD },
  });
  expect(loggedIn.status(), await loggedIn.text()).toBe(200);
}

async function addPhotos(listingId: string): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const ids: string[] = [];
    for (let position = 0; position < 3; position += 1) {
      const row = await client.query<{ id: string }>(
        `INSERT INTO listing_photos (listing_id, storage_prefix, width, height, position, is_cover, blurhash)
         VALUES ($1, $2, 1000, 750, $3, $4, 'LEHV6nWB2yk8pyo0adR*.7kCMdnj')
         RETURNING id`,
        [listingId, `e2e-pwa/${randomUUID()}`, position, position === 0],
      );
      ids.push(row.rows[0]?.id ?? '');
    }

    await client.query('UPDATE listings SET cover_photo_id = $1 WHERE id = $2', [
      ids[0],
      listingId,
    ]);
  } finally {
    await client.end();
  }
}

async function createPublishedListing(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/v1/listings', { data: { type: 'house' } });
  expect(created.status(), await created.text()).toBe(201);
  const listingId = ((await created.json()) as { listing: { id: string } }).listing.id;

  const patched = await request.patch(`/api/v1/listings/${listingId}`, {
    data: {
      title: 'Дом у озера для офлайн-теста',
      description: DESCRIPTION,
      country: 'RU',
      region: 'Владимирская область',
      city: 'Суздаль',
      addressLine: 'улица Лесная, 12',
      maxGuests: 4,
      bedrooms: 2,
      beds: 3,
      basePriceMinor: 750_000,
      cleaningFeeMinor: 150_000,
      minNights: 2,
      maxNights: 14,
    },
  });
  expect(patched.status(), await patched.text()).toBe(200);

  await addPhotos(listingId);

  const published = await request.post(`/api/v1/listings/${listingId}/publish`);
  expect(published.status(), await published.text()).toBe(200);
  return listingId;
}

async function uiLogin(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('link', { name: /Профиль/ })).toBeVisible();
}

async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), undefined, {
    timeout: 30_000,
  });
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      timeout: 30_000,
    })
    .toBe(true);
}

async function populateCaches(page: Page, listingId: string): Promise<void> {
  // Сначала даём SW установиться и взять вкладку под контроль,
  // и только потом наполняем runtime-кэши: иначе тест зависит от гонки активации.
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.reload();

  await page.goto(`/listings/${listingId}`);
  await expect(page.getByRole('heading', { name: 'Дом у озера для офлайн-теста' })).toBeVisible();
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'Избранное' })).toBeVisible();
  await page.goto('/trips');
  await expect(page.getByRole('heading', { name: 'Мои поездки' })).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => caches.keys()), { timeout: 30_000 })
    .toEqual(expect.arrayContaining(['staynest-me', 'staynest-catalog']));
}

async function assertOfflineReading(page: Page, listingId: string): Promise<void> {
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'Избранное' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Дом у озера для офлайн-теста' })).toBeVisible();
  await expect(page.getByText('Нет сети. Показываем сохранённое.')).toBeVisible();

  await page.goto('/trips');
  await expect(page.getByRole('heading', { name: 'Мои поездки' })).toBeVisible();
  await expect(page.getByText('Дом у озера для офлайн-теста')).toBeVisible();

  await page.goto(`/listings/${listingId}`);
  await expect(page.getByRole('heading', { name: 'Дом у озера для офлайн-теста' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Убрать из избранного' })).toBeDisabled();
}

async function logoutAndCollectLeftovers(page: Page, email: string) {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Выйти из аккаунта' }).click();
  await expect(page).toHaveURL('/');

  const leftover = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const databases = (await indexedDB.databases?.()) ?? [];
    const personalLocalKeys = Object.keys(localStorage).filter(
      (key) => key.startsWith('staynest:listing-draft:') || key === 'staynest:push-owner',
    );

    return {
      // Публичный каталог может наполниться заново после перехода на главную;
      // персональный кэш /me после выхода появляться не должен.
      caches: cacheNames.filter((name) => name === 'staynest-me'),
      // Workbox создаёт служебную базу сроков кэша заново после перехода на главную.
      databases: databases
        .map((database) => database.name)
        .filter((name) => name && name !== 'workbox-expiration'),
      personalLocalKeys,
      localStorageDump: JSON.stringify(localStorage),
    };
  });

  expect(leftover.caches).toEqual([]);
  expect(leftover.databases).toEqual([]);
  expect(leftover.personalLocalKeys).toEqual([]);
  expect(leftover.localStorageDump).not.toContain(email);
  expect(leftover.localStorageDump).not.toContain('Дом у озера для офлайн-теста');
}

test('офлайн-чтение избранного и поездок, затем очистка данных при выходе', async ({
  context,
  page,
  request,
}) => {
  const hostContext = await apiRequest.newContext({
    baseURL: 'http://127.0.0.1:4173',
  });
  await registerAndLogin(hostContext, uniqueEmail('pwa-host'), 'Хозяйка');
  const listingId = await createPublishedListing(hostContext);
  await hostContext.dispose();

  const guestEmail = uniqueEmail('pwa-guest');
  await registerAndLogin(request, guestEmail, 'Гость');
  await uiLogin(page, guestEmail);

  const favorite = await request.put(`/api/v1/me/favorites/${listingId}`);
  expect(favorite.status(), await favorite.text()).toBe(200);

  const booking = await request.post('/api/v1/bookings', {
    headers: { 'Idempotency-Key': randomUUID() },
    data: {
      listingId,
      checkIn: isoDate(10),
      checkOut: isoDate(12),
      guestsCount: 2,
      guestMessage: 'Офлайн-тест',
    },
  });
  expect(booking.status(), await booking.text()).toBe(201);

  await populateCaches(page, listingId);

  await context.setOffline(true);
  await assertOfflineReading(page, listingId);
  await context.setOffline(false);

  await logoutAndCollectLeftovers(page, guestEmail);

  // После выхода на общем устройстве офлайн не должно быть чужих избранного и поездок.
  await context.setOffline(true);
  await page.goto('/favorites');
  await expect(page.getByText('Дом у озера для офлайн-теста')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
  await context.setOffline(false);
});
