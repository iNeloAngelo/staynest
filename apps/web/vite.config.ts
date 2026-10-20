import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { ManifestOptions, VitePWAOptions } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const DAY_MS = 24 * 60 * 60 * 1000;

type WorkboxRuntimeCaching = NonNullable<NonNullable<VitePWAOptions['workbox']>['runtimeCaching']>;

const runtimeCaching: WorkboxRuntimeCaching = [
  {
    // Персональные данные: NetworkFirst с офлайн-фолбэком.
    // Кэш чистится при выходе (features/pwa/model/cleanup.ts).
    // Регулярки в urlPattern должны быть литералами внутри функции:
    // Workbox сериализует функцию через toString(), внешние const не попадут в SW.
    urlPattern: ({ url }) =>
      /^\/api\/v1\/me$|^\/api\/v1\/me\/(bookings|favorites)(\/|$)/.test(url.pathname),
    handler: 'NetworkFirst',
    options: {
      cacheName: 'staynest-me',
      networkTimeoutSeconds: 4,
      cacheableResponse: { statuses: [200] },
      expiration: { maxEntries: 40, maxAgeSeconds: 7 * DAY_MS },
    },
  },
  {
    // Публичный каталог и карточки: быстрый старт, обновление в фоне.
    urlPattern: ({ url }) =>
      url.pathname === '/api/v1/listings' ||
      /^\/api\/v1\/listings\/[0-9a-f-]{36}$/.test(url.pathname),
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'staynest-catalog',
      cacheableResponse: { statuses: [200] },
      expiration: { maxEntries: 60, maxAgeSeconds: 10 * 60 },
    },
  },
  {
    // Фото и аватары неизменяемы: ключ содержит UUID.
    urlPattern: ({ url }) => url.pathname.startsWith('/media/'),
    handler: 'CacheFirst',
    options: {
      cacheName: 'staynest-media',
      cacheableResponse: { statuses: [200] },
      expiration: { maxEntries: 150, maxAgeSeconds: 30 * DAY_MS },
    },
  },
];

const manifest: Partial<ManifestOptions> = {
  id: '/',
  name: 'StayNest — аренда домов',
  short_name: 'StayNest',
  description: 'Дома у леса и озера: свободные даты, честная цена и бронирование без переписок.',
  lang: 'ru',
  dir: 'ltr',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: '#FAF7F2',
  theme_color: '#FAF7F2',
  categories: ['travel', 'lifestyle'],
  prefer_related_applications: false,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
  screenshots: [
    {
      src: '/screenshots/s15-home-360.png',
      sizes: '360x640',
      type: 'image/png',
      form_factor: 'narrow',
    },
    {
      src: '/screenshots/s15-home-1280.png',
      sizes: '1280x800',
      type: 'image/png',
      form_factor: 'wide',
    },
  ],
  shortcuts: [
    { name: 'Избранное', short_name: 'Избранное', url: '/favorites' },
    { name: 'Мои поездки', short_name: 'Поездки', url: '/trips' },
  ],
};

const pwaOptions = {
  // SW регистрирует приложение, а не HTML: нужен баннер обновления.
  injectRegister: null,
  registerType: 'prompt' as const,
  manifestFilename: 'manifest.webmanifest',
  includeAssets: ['icons/*.png'],
  manifest,
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
    // Скриншоты манифеста не нужны офлайн и весят больше оболочки.
    globIgnores: ['screenshots/**', 'splash/**'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
    cleanupOutdatedCaches: true,
    // Новый SW ждёт кнопку «Обновить» в интерфейсе.
    skipWaiting: false,
    clientsClaim: true,
    importScripts: ['push-sw.js'],
    runtimeCaching,
  },
  devOptions: { enabled: false },
} satisfies Partial<VitePWAOptions>;

export default defineConfig(({ mode }) => {
  // .env лежит в корне монорепо: pnpm запускает конфиг из apps/web.
  // loadEnv читает NODE_ENV=development из .env и выставляет VITE_USER_NODE_ENV:
  // без восстановления production-сборка собирается как dev (dev/ui и /push-sw.js).
  const nodeEnv = process.env.NODE_ENV;
  const userNodeEnv = process.env.VITE_USER_NODE_ENV;
  const env = loadEnv(mode, '../..', '');

  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;

  if (userNodeEnv === undefined) delete process.env.VITE_USER_NODE_ENV;
  else process.env.VITE_USER_NODE_ENV = userNodeEnv;

  const s3Endpoint = env.S3_ENDPOINT || 'http://localhost:9000';
  const s3Bucket = env.S3_BUCKET || 'staynest-media';

  return {
    plugins: [react(), tailwindcss(), VitePWA(pwaOptions)],
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:3100', changeOrigin: false },
        // В dev Caddy нет: раздаём объекты Silo напрямую, как /media в проде.
        '/media': {
          target: s3Endpoint,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/media/, `/${s3Bucket}`),
        },
      },
    },
    // `vite preview` проверяет production-сборку и SW в e2e.
    preview: {
      host: '127.0.0.1',
      port: 4173,
      proxy: {
        '/api': { target: 'http://localhost:3100', changeOrigin: false },
        '/media': {
          target: s3Endpoint,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/media/, `/${s3Bucket}`),
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      // Мастер объявления в jsdom занимает ~4 с; при параллельном прогоне
      // дефолтные 5 с дают флап. Это верхняя граница, а не цель.
      testTimeout: 15_000,
      hookTimeout: 15_000,
    },
  };
});
