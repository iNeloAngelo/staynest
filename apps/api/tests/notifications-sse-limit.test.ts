import type { Client } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
} from './support/harness';
import type { Harness } from './support/harness';

const url = databaseUrl ?? '';

async function listen(h: Harness): Promise<string> {
  return h.app.listen({ port: 0, host: '127.0.0.1' });
}

function openStream(baseUrl: string, cookie: string, controller: AbortController) {
  return fetch(`${baseUrl}/api/v1/me/events`, {
    headers: { cookie, accept: 'text/event-stream' },
    signal: controller.signal,
  });
}

describeDatabase('SSE: лимит и остановка', () => {
  let client: Client;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
  });

  afterAll(async () => {
    await client?.end();
  });

  it('отдаёт 429 на шестой поток и не оставляет зомби-соединений', async () => {
    if (!url) return;
    const h = await createHarness();
    const baseUrl = await listen(h);
    const user = await createUser(h, 'limit@example.ru', 'Лимит');
    const controllers = [0, 1, 2, 3, 4].map(() => new AbortController());

    try {
      for (const controller of controllers) {
        const response = await openStream(baseUrl, user.cookie, controller);
        expect(response.status).toBe(200);
      }

      const extra = new AbortController();
      const sixth = await openStream(baseUrl, user.cookie, extra);
      expect(sixth.status).toBe(429);
      expect(sixth.headers.get('content-type')).toContain('application/problem+json');
      expect(await sixth.json()).toMatchObject({ code: 'too_many_event_streams' });
      extra.abort();
    } finally {
      for (const controller of controllers) controller.abort();
      await h.app.close();
      await h.db.close();
    }
  });

  it('закрывает открытый поток при app.close(), а не висит до таймаута', async () => {
    if (!url) return;
    const h = await createHarness();
    const baseUrl = await listen(h);
    const user = await createUser(h, 'close@example.ru', 'Закрытие');
    const controller = new AbortController();
    const response = await openStream(baseUrl, user.cookie, controller);
    expect(response.status).toBe(200);

    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('app.close() не завершился за 3 секунды')), 3_000);
      });

      await expect(Promise.race([h.app.close(), timeout])).resolves.toBeUndefined();
    } finally {
      controller.abort();
      await h.db.close();
    }
  });

  it('не создаёт SSE-подписку на HEAD', async () => {
    if (!url) return;
    const h = await createHarness();
    const baseUrl = await listen(h);
    const user = await createUser(h, 'head@example.ru', 'Head');

    try {
      const response = await fetch(`${baseUrl}/api/v1/me/events`, {
        method: 'HEAD',
        headers: { cookie: user.cookie },
      });

      expect(response.status).toBe(404);
    } finally {
      await h.app.close();
      await h.db.close();
    }
  });
});
