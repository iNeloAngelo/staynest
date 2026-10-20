/**
 * Запись демо-тура по живому стенду.
 *
 * Запуск: node scripts/demo-tour.mjs
 * Нужны: playwright chromium, доступ к сети, Docker (для конвертации webm → mp4/gif).
 *
 * Скрипт ничего не меняет в приложении: только смотрит каталог, карточку,
 * «Мои поездки», избранное, сводку хозяина и входящие заявки.
 * Сессии гостя и хозяина готовятся заранее через форму входа, а запись
 * начинается уже с готовыми cookie — так в кадр не попадает экран логина.
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BASE = process.env.DEMO_BASE_URL ?? 'https://olivertwist95.clodocd.com';
const OUT_DIR = resolve('tmp/demo');
const MEDIA_DIR = resolve('docs/media');
const GUEST = { email: 'guest@staynest.demo', password: 'StayNest-Demo-2026' };
const HOST = { email: 'host@staynest.demo', password: 'StayNest-Demo-2026' };
const FFMPEG_IMAGE =
  process.env.FFMPEG_IMAGE ??
  'linuxserver/ffmpeg@sha256:742e17516dd4d7b76b939d774bd08f0f6b7cab8bce1c014b95ab2fb992fd0a1f';

const wait = (page, ms) => page.waitForTimeout(ms);

async function scroll(page, distance, steps = 8, delay = 90) {
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, distance / steps);
    await wait(page, delay);
  }
}

/** Логин в отдельном контексте: возвращает cookie для записи. */
async function prepareSession(browser, { email, password }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  const emailInput = page.locator('input[autocomplete="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 60_000 });
  await emailInput.fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45_000 });
  const cookies = await context.cookies();
  await context.close();
  return cookies;
}

async function openFirstListing(page) {
  const link = page.locator('a[href^="/listings/"]').first();
  await link.waitFor({ state: 'visible', timeout: 30_000 });
  const href = await link.getAttribute('href');
  await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' });
  await wait(page, 2500);
}

function convert(videoPath) {
  mkdirSync(MEDIA_DIR, { recursive: true });
  const hostRoot = process.cwd().replace(/\\/g, '/');
  const rel = videoPath.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '');
  const docker = (args) =>
    execFileSync(
      'docker',
      ['run', '--rm', '-v', `${hostRoot}:/w`, '-w', '/w', FFMPEG_IMAGE, ...args],
      { stdio: 'inherit' },
    );

  // MP4 для портфолио: H.264, без звука.
  docker([
    '-y',
    '-i',
    rel,
    '-vf',
    'scale=1280:-2',
    '-c:v',
    'libx264',
    '-crf',
    '28',
    '-preset',
    'medium',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    'docs/media/tour.mp4',
  ]);

  // GIF-тизер: первые 32 секунды, ускорение ×2, 10 fps, 640 px.
  docker([
    '-y',
    '-i',
    rel,
    '-vf',
    'trim=0:32,setpts=0.5*(PTS-STARTPTS),fps=8,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer',
    '-loop',
    '0',
    'docs/media/tour.gif',
  ]);
}

async function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const guestCookies = await prepareSession(browser, GUEST);
  const hostCookies = await prepareSession(browser, HOST);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
    storageState: { cookies: guestCookies, origins: [] },
  });
  const page = await context.newPage();

  try {
    // 1. Каталог: карточки, цены, фильтры. Сортировка по цене ставит вперёд
    //    «витринные» дома и не цепляет старые тестовые объявления.
    await page.goto(`${BASE}/?sort=price_desc`, { waitUntil: 'domcontentloaded' });
    await wait(page, 4500);
    await page.mouse.move(640, 420);
    await scroll(page, 900, 12, 120);
    await wait(page, 1200);
    await scroll(page, -900, 10, 100);
    await wait(page, 1000);

    // 2. Карточка дома: галерея, календарь, цена за период.
    await openFirstListing(page);
    await scroll(page, 1200, 12, 120);
    await wait(page, 1000);
    await scroll(page, -1200, 10, 100);
    await wait(page, 2500);

    // 3. Гость: «Мои поездки».
    await page.goto(`${BASE}/trips`, { waitUntil: 'domcontentloaded' });
    await wait(page, 2500);
    await scroll(page, 700, 8, 110);
    await wait(page, 2500);

    // 4. Деталь брони: статус, таймлайн, депозит.
    const bookingLink = page.locator('a[href^="/bookings/"]').first();
    if ((await bookingLink.count()) > 0) {
      const bookingHref = await bookingLink.getAttribute('href');
      await page.goto(`${BASE}${bookingHref}`, { waitUntil: 'domcontentloaded' });
      await wait(page, 3000);
      await scroll(page, 600, 8, 110);
      await wait(page, 2000);
    }

    // 5. Избранное.
    await page.goto(`${BASE}/favorites`, { waitUntil: 'domcontentloaded' });
    await wait(page, 2500);
    await wait(page, 3000);

    // 6. Хозяин: сводка, заявки и календарь (сессия подменяется cookie).
    await context.clearCookies();
    await context.addCookies(hostCookies);
    await page.goto(`${BASE}/host`, { waitUntil: 'domcontentloaded' });
    await wait(page, 4000);
    await scroll(page, 800, 9, 110);
    await wait(page, 2000);
    await page.goto(`${BASE}/host/requests`, { waitUntil: 'domcontentloaded' });
    await wait(page, 3000);
    await scroll(page, 400, 5, 110);
    await wait(page, 2000);
    await page.goto(`${BASE}/host/calendar`, { waitUntil: 'domcontentloaded' });
    await wait(page, 3000);
    await wait(page, 3000);

    // 7. Профиль: язык, тема, push.
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await wait(page, 3000);
    await wait(page, 3000);
  } finally {
    await context.close();
    await browser.close();
  }

  const files = readdirSync(OUT_DIR).filter((name) => name.endsWith('.webm'));
  if (files.length === 0) throw new Error('Playwright не записал видео');
  const video = join(OUT_DIR, files[0]);
  console.log(`video: ${video} (${(statSync(video).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log('Конвертация через Docker linuxserver/ffmpeg…');
  convert(video);
  console.log('Готово: docs/media/tour.mp4 и docs/media/tour.gif');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
