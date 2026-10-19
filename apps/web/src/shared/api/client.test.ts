import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './client';
import { jsonResponse } from '../../test/api-mocks';

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window.navigator, 'locks');
});

describe('api client', () => {
  it('разбирает problem+json в ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            type: 'about:blank',
            title: 'Unauthorized',
            status: 401,
            detail: 'Неверный email или пароль.',
            code: 'invalid_credentials',
          },
          401,
        ),
      ),
    );

    const promise = api.post('/auth/login', { email: 'a@b.c', password: 'x' });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
      detail: 'Неверный email или пароль.',
    });
  });

  it('считает сетевую ошибку отдельным кодом', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(api.get('/me')).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    });
  });

  it('не обновляет сессию для auth-эндпоинтов', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ code: 'invalid_credentials' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('делает один refresh на два параллельных 401 даже при Web Locks', async () => {
    let lockQueue: Promise<void> = Promise.resolve();
    const request = vi.fn((_name: string, callback: () => Promise<unknown>) => {
      const result = lockQueue.then(() => callback());
      lockQueue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    });
    Object.defineProperty(window.navigator, 'locks', {
      configurable: true,
      value: { request },
    });

    let refreshCalls = 0;
    const attempts = new Map<string, number>();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith('/auth/refresh')) {
          refreshCalls += 1;
          return jsonResponse({ user: { id: 'user' } });
        }

        const attempt = (attempts.get(url) ?? 0) + 1;
        attempts.set(url, attempt);
        return attempt === 1
          ? jsonResponse({ code: 'unauthorized' }, 401)
          : jsonResponse({ ok: true });
      }),
    );

    const [first, second] = await Promise.all([api.get('/first'), api.get('/second')]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('делает один refresh на два параллельных 401 и повторяет запросы', async () => {
    let refreshCalls = 0;
    const attempts = new Map<string, number>();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return jsonResponse({ user: { id: 'user' } });
      }

      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      return attempt === 1
        ? jsonResponse({ code: 'unauthorized' }, 401)
        : jsonResponse({ ok: true });
    });

    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([
      api.get<{ ok: boolean }>('/first'),
      api.get<{ ok: boolean }>('/second'),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
  });

  it('не превращает сбой refresh в «гостя»', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse({ code: 'internal_error', detail: 'Сбой' }, 500);
      }
      return jsonResponse({ code: 'unauthorized' }, 401);
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/me')).rejects.toMatchObject({ status: 500, code: 'internal_error' });
  });

  it('считает сетевой сбой refresh ошибкой, а не выходом', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh')) throw new TypeError('Failed to fetch');
        return jsonResponse({ code: 'unauthorized' }, 401);
      }),
    );

    await expect(api.get('/me')).rejects.toMatchObject({ status: 0, code: 'network_error' });
  });

  it('сериализует refresh через Web Locks, когда API доступен', async () => {
    const request = vi.fn(async (_name: string, callback: () => Promise<unknown>) => callback());
    Object.defineProperty(window.navigator, 'locks', {
      configurable: true,
      value: { request },
    });

    const attempts = new Map<string, number>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh')) return jsonResponse({ user: { id: 'user' } });

        const attempt = (attempts.get(url) ?? 0) + 1;
        attempts.set(url, attempt);
        return attempt === 1
          ? jsonResponse({ code: 'unauthorized' }, 401)
          : jsonResponse({ ok: true });
      }),
    );

    await expect(api.get('/me')).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenCalledWith('staynest-refresh', expect.any(Function));
  });

  it('возвращает исходный 401, если refresh не удался', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) return jsonResponse({ code: 'invalid_token' }, 401);
      return jsonResponse({ code: 'unauthorized' }, 401);
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/me')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('возвращает 204 как undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(api.post<void>('/auth/logout')).resolves.toBeUndefined();
  });
});
