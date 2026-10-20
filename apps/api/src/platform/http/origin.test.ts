import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { createOriginGuard } from './origin';

function request(
  method: string,
  headers: Record<string, string>,
  url = '/api/v1/bookings',
): FastifyRequest {
  return { method, headers, url } as unknown as FastifyRequest;
}

describe('origin guard', () => {
  const guard = createOriginGuard(['https://staynest.example']);

  it('пропускает безопасные методы без проверки Origin', async () => {
    await expect(
      guard(request('GET', { origin: 'https://evil.example' })),
    ).resolves.toBeUndefined();
  });

  it('пропускает разрешённый Origin и запросы без Origin', async () => {
    await expect(
      guard(request('POST', { origin: 'https://staynest.example' })),
    ).resolves.toBeUndefined();
    await expect(guard(request('POST', {}))).resolves.toBeUndefined();
  });

  it('отклоняет чужой Origin', async () => {
    await expect(guard(request('POST', { origin: 'https://evil.example' }))).rejects.toMatchObject({
      code: 'origin_not_allowed',
      status: 403,
    });
  });

  it('пускает Origin: null только при same-origin Fetch Metadata', async () => {
    await expect(
      guard(request('POST', { origin: 'null', 'sec-fetch-site': 'same-origin' })),
    ).resolves.toBeUndefined();

    await expect(
      guard(request('POST', { origin: 'null', 'sec-fetch-site': 'cross-site' })),
    ).rejects.toMatchObject({ code: 'origin_not_allowed' });
  });

  it('освобождает только точный путь вебхука', async () => {
    await expect(
      guard(
        request('POST', { origin: 'https://provider.example' }, '/api/v1/payments/webhook/mock'),
      ),
    ).resolves.toBeUndefined();

    await expect(
      guard(
        request('POST', { origin: 'https://evil.example' }, '/api/v1/payments/webhook/mock/extra'),
      ),
    ).rejects.toMatchObject({ code: 'origin_not_allowed' });
  });

  it('в dev разрешает loopback на любом порту, в production — только список', async () => {
    const dev = createOriginGuard(['http://localhost:5173'], { allowLoopback: true });
    await expect(
      dev(request('POST', { origin: 'http://127.0.0.1:5174' })),
    ).resolves.toBeUndefined();
    await expect(dev(request('POST', { origin: 'http://[::1]:4173' }))).resolves.toBeUndefined();

    const prod = createOriginGuard(['https://staynest.example'], { allowLoopback: false });
    await expect(prod(request('POST', { origin: 'http://127.0.0.1:5173' }))).rejects.toMatchObject({
      code: 'origin_not_allowed',
    });
  });
});
