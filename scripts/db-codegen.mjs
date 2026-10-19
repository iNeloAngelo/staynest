import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { databaseUrl } from './db-helpers.mjs';

const outFile = fileURLToPath(
  new URL('../apps/api/src/platform/db/schema.generated.ts', import.meta.url),
);
const url = databaseUrl();

const require = createRequire(import.meta.url);
const packagePath = require.resolve('kysely-codegen/package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const binRelative =
  typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.['kysely-codegen'];

if (!binRelative) throw new Error('Не найден исполняемый файл kysely-codegen');

const result = spawnSync(
  process.execPath,
  [
    resolve(dirname(packagePath), binRelative),
    '--out-file',
    outFile,
    '--default-schema',
    'public',
    '--exclude-pattern',
    'pgmigrations',
    '--type-only-imports',
    '--date-parser',
    'string',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const header =
  '/* eslint-disable */\n// Файл сгенерирован kysely-codegen. Не редактировать вручную, пересобрать: pnpm db:codegen.\n';
const generated = readFileSync(outFile, 'utf8');
if (!generated.startsWith('/* eslint-disable */')) {
  writeFileSync(outFile, header + generated);
}
console.log(`Типы БД записаны в ${outFile}`);
