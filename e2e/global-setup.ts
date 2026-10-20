import { Client } from 'pg';

const databaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgres://staynest:staynest@127.0.0.1:5433/staynest_e2e_test';

const parsed = new URL(databaseUrl);
if (!parsed.pathname.endsWith('_test')) {
  throw new Error(`E2E-база должна оканчиваться на _test: ${parsed.pathname}`);
}
if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
  throw new Error(`E2E-база должна быть на loopback: ${parsed.hostname}`);
}

export default async function setup(): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ users: string | null }>(
      "SELECT to_regclass('public.users')::text AS users",
    );
    if (!result.rows[0]?.users) {
      throw new Error('E2E-база не подготовлена. Выполните `pnpm e2e:prepare` с E2E_DATABASE_URL.');
    }
  } finally {
    await client.end();
  }
}
