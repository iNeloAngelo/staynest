import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

const PASSWORD = 'Forest-Lake-2026';
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://staynest:staynest@127.0.0.1:5433/staynest_e2e_test';

const DESCRIPTION =
  'Тихий дом с террасой, камином и видом на сосновый лес. Подходит для семьи из четырёх человек.';

type Account = { email: string; userId: string };

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function longDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1, 12));
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.ru`;
}

async function register(request: APIRequestContext, email: string, name: string): Promise<void> {
  const response = await request.post('/api/v1/auth/register', {
    data: { email, password: PASSWORD, displayName: name, locale: 'ru' },
  });
  expect(response.status(), await response.text()).toBe(202);
}

async function apiLogin(request: APIRequestContext, email: string, name: string): Promise<Account> {
  await register(request, email, name);
  const response = await request.post('/api/v1/auth/login', {
    data: { email, password: PASSWORD },
  });
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as { user: { id: string } };
  return { email, userId: body.user.id };
}

async function uiLogin(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('link', { name: /Профиль/ })).toBeVisible();
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
        [listingId, `e2e/${randomUUID()}`, position, position === 0],
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
      title: 'Дом у озера для e2e',
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

test('хозяин публикует дом, гость бронирует, хозяин подтверждает, гость видит статус', async ({
  browser,
  request,
}) => {
  const host = await apiLogin(request, uniqueEmail('host'), 'Хозяйка');
  const listingId = await createPublishedListing(request);
  const guest = await apiLogin(request, uniqueEmail('guest'), 'Гость');

  const guestPage = await browser.newPage();
  await uiLogin(guestPage, guest.email);
  await guestPage.goto(`/listings/${listingId}`);
  await expect(guestPage.getByRole('heading', { name: 'Дом у озера для e2e' })).toBeVisible();

  const checkIn = isoDate(10);
  const checkOut = isoDate(12);
  await guestPage.getByRole('button', { name: `${longDate(checkIn)}, доступно` }).click();
  await guestPage.getByRole('button', { name: `${longDate(checkOut)}, доступно` }).click();
  await expect(guestPage.getByText('Итого')).toBeVisible();

  await guestPage.getByLabel('Сообщение хозяину').fill('Приедем к вечеру, нас двое.');
  await guestPage.getByRole('button', { name: 'Отправить заявку' }).click();

  await expect(guestPage.getByRole('heading', { name: 'Заявка отправлена' })).toBeVisible();
  await expect(guestPage.getByText('Ожидает ответа').first()).toBeVisible();
  const bookingUrl = guestPage.url();

  const hostPage = await browser.newPage();
  await uiLogin(hostPage, host.email);

  await expect(hostPage.getByRole('button', { name: /непрочитанных/ })).toBeVisible();
  await hostPage.getByRole('button', { name: /непрочитанных/ }).click();
  const hostNotifications = hostPage.getByRole('dialog', { name: 'Уведомления' });
  await expect(hostNotifications.getByText('Новая заявка')).toBeVisible();
  await hostPage.keyboard.press('Escape');

  await hostPage.goto('/host/requests');
  await expect(hostPage.getByRole('heading', { name: 'Входящие заявки' })).toBeVisible();
  await expect(hostPage.getByText('Приедем к вечеру, нас двое.')).toBeVisible();

  await hostPage.getByRole('button', { name: 'Подтвердить' }).click();
  const dialog = hostPage.getByRole('dialog', { name: 'Подтвердить заявку?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(hostPage.getByText('Заявка подтверждена')).toBeVisible();

  // SSE: гость видит новое уведомление и счётчик без перезагрузки страницы.
  const guestBell = guestPage.getByRole('button', { name: /непрочитанных/ });
  await expect(guestBell).toBeVisible();
  await guestBell.click();
  const guestNotifications = guestPage.getByRole('dialog', { name: 'Уведомления' });
  await expect(guestNotifications.getByText('Бронь подтверждена')).toBeVisible();
  await guestPage.keyboard.press('Escape');

  await guestPage.goto(bookingUrl);
  await expect(guestPage.getByText('Подтверждено').first()).toBeVisible();
  await expect(guestPage.getByRole('heading', { name: 'Контакты' })).toBeVisible();
  await expect(guestPage.getByText('улица Лесная, 12')).toBeVisible();
});
