import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';
const databaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgres://staynest:staynest@127.0.0.1:5433/staynest_e2e_test';

/**
 * Production-сборка и настоящий Workbox SW: проверяем офлайн-чтение,
 * баннер сети и очистку персональных кэшей при выходе.
 */
export default defineConfig({
  testDir: './e2e-pwa',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-pwa' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ru-RU',
    serviceWorkers: 'allow',
  },
  webServer: [
    {
      command: 'pnpm -C apps/api exec tsx src/server.ts',
      url: 'http://127.0.0.1:3100/api/v1/health',
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        API_HOST: '127.0.0.1',
        DATABASE_URL: databaseUrl,
        DATABASE_URL_TEST: databaseUrl,
        REQUIRE_EMAIL_VERIFICATION: 'false',
        APP_WEB_URL: baseURL,
        CORS_ORIGINS: `${baseURL},http://127.0.0.1:5173,http://localhost:5173`,
        JWT_SECRET: 'dev-only-e2e-secret-with-at-least-32-characters',
      },
    },
    {
      command: 'pnpm -C apps/web build && pnpm -C apps/web exec vite preview',
      url: baseURL,
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
});
