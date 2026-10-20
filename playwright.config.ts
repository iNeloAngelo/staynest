import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5173';
const databaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgres://staynest:staynest@127.0.0.1:5433/staynest_e2e_test';

export default defineConfig({
  testDir: './e2e',
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
      command: 'pnpm db:reset:test && pnpm -C apps/api exec tsx src/server.ts',
      url: 'http://127.0.0.1:3100/api/v1/health',
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        DATABASE_URL_TEST: databaseUrl,
        REQUIRE_EMAIL_VERIFICATION: 'false',
        APP_WEB_URL: baseURL,
        CORS_ORIGINS: `${baseURL},http://localhost:5173`,
        JWT_SECRET: 'e2e-secret-with-at-least-32-characters-long',
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
