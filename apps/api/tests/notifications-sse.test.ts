import type { Client } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { NotificationDto } from '@staynest/shared';
import { addDays } from '@staynest/shared';
import { createBookingRequest, futureDay, seedListing } from './support/booking-fixtures';
import {
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
} from './support/harness';
import type { Harness, TestUser } from './support/harness';

const url = databaseUrl ?? '';
const READ_TIMEOUT_MS = 5_000;

type StreamReader = {
  readUntil: (needle: string) => Promise<string>;
  close: () => void;
};

function streamReader(response: Response): StreamReader {
  const body = response.body;
  if (!body) throw new Error('SSE-ответ без тела');

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return {
    async readUntil(needle) {
      const deadline = Date.now() + READ_TIMEOUT_MS;

      while (!buffer.includes(needle)) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error(`SSE: не дождались ${JSON.stringify(needle)}`);

        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`SSE: таймаут ${JSON.stringify(needle)}`));
          }, remaining);
        });
        const chunk = await Promise.race([reader.read(), timeout]).finally(() => {
          if (timer) clearTimeout(timer);
        });

        if (chunk.done) throw new Error(`SSE закрылся до ${JSON.stringify(needle)}`);
        buffer += decoder.decode(chunk.value, { stream: true });
      }

      const index = buffer.indexOf(needle) + needle.length;
      const result = buffer.slice(0, index);
      buffer = buffer.slice(index);
      return result;
    },

    close() {
      void reader.cancel();
    },
  };
}

describeDatabase('SSE уведомлений', () => {
  let client: Client;
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let baseUrl: string;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    host = await createUser(h, 'host@example.ru', 'Хозяин');
    guest = await createUser(h, 'guest@example.ru', 'Гость');
    const address = await h.app.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = address;
  });

  afterAll(async () => {
    await h?.app.close();
    await h?.db.close();
    await client?.end();
  });

  it('закрыт без авторизации', async () => {
    const response = await fetch(`${baseUrl}/api/v1/me/events`);
    expect(response.status).toBe(401);
  });

  it('отдаёт новое уведомление без перезагрузки и держит heartbeat-формат', async () => {
    const listingId = await seedListing(h, host.id);
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/v1/me/events`, {
      headers: { cookie: host.cookie, accept: 'text/event-stream' },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toContain('no-store');

    const reader = streamReader(response);

    try {
      const handshake = await reader.readUntil(': connected\n\n');
      expect(handshake).toContain('retry: 3000');

      const checkIn = futureDay(40);
      const booking = await createBookingRequest(h, guest, listingId, {
        checkIn,
        checkOut: addDays(checkIn, 2),
      });
      expect(booking.statusCode).toBe(201);

      const block = await reader.readUntil('\n\n');
      const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
      expect(dataLine).toBeDefined();

      const notification = JSON.parse(dataLine?.slice('data: '.length) ?? '{}') as NotificationDto;
      expect(notification.type).toBe('booking_requested');
      expect(notification.payload).toMatchObject({
        listingTitle: 'Дом у озера',
        guestName: 'Гость',
        checkIn,
      });
      expect(block).toContain(`id: ${notification.id}`);
    } finally {
      reader.close();
      controller.abort();
    }
  });
});
