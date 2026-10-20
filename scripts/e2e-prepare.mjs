import { spawnSync } from 'node:child_process';

const url = process.env.E2E_DATABASE_URL?.trim();

if (!url) {
  throw new Error(
    'E2E_DATABASE_URL не задан. Укажите отдельную тестовую базу, например postgres://staynest:staynest@127.0.0.1:5433/staynest_e2e_test',
  );
}

const parsed = new URL(url);
if (!parsed.pathname.endsWith('_test')) {
  throw new Error(`E2E-база должна оканчиваться на _test, получено: ${parsed.pathname}`);
}
if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
  throw new Error(`E2E-база должна быть на loopback, получено: ${parsed.hostname}`);
}

const result = spawnSync('node', ['scripts/db-reset.mjs', '--test'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL_TEST: url },
});

process.exit(result.status ?? 1);
