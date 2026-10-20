import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5173';
const databaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgres://staynest:staynest@127.0.0.1:5433/staynest_e2e_test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ru-RU',
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
        CORS_ORIGINS: `${baseURL},http://localhost:5173`,
        JWT_SECRET: 'dev-only-e2e-secret-with-at-least-32-characters',
      },
    },
    {
      command: 'pnpm -C apps/web dev',
      url: baseURL,
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
