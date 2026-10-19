import { vi } from 'vitest';
import type { UserDto } from '@staynest/shared';

export const demoUser: UserDto = {
  id: '3d0f2f4b-8c47-4d0a-9d55-6f8f1f8b5a11',
  email: 'anna@example.com',
  displayName: 'Анна',
  phone: null,
  avatarKey: null,
  locale: 'ru',
  emailVerified: true,
  createdAt: '2026-10-19T10:00:00.000Z',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export type ApiMockOptions = {
  user?: UserDto | null;
  loginStatus?: number;
  loginBody?: unknown;
  registerBody?: unknown;
  onRequest?: (url: string, init?: RequestInit) => void;
};

const SIMPLE_ROUTES: Array<[string, () => Response]> = [
  ['/auth/logout', () => new Response(null, { status: 204 })],
  ['/auth/verify-email', () => new Response(null, { status: 204 })],
  ['/auth/reset-password', () => new Response(null, { status: 204 })],
  ['/auth/forgot-password', () => jsonResponse({ status: 'accepted' }, 202)],
  ['/health', () => jsonResponse({ status: 'ok', db: 'up', version: '0.1.0', uptime: 1 })],
];

function sessionResponse(user: UserDto | null): Response {
  return user ? jsonResponse({ user }) : jsonResponse({ code: 'unauthorized' }, 401);
}

function route(input: RequestInfo | URL, options: ApiMockOptions): Response {
  const url = String(input);
  const user = options.user ?? null;

  if (url.endsWith('/auth/refresh') || url.endsWith('/me')) return sessionResponse(user);

  if (url.endsWith('/auth/login')) {
    return jsonResponse(options.loginBody ?? { user: demoUser }, options.loginStatus ?? 200);
  }

  if (url.endsWith('/auth/register')) {
    return jsonResponse(
      options.registerBody ?? { status: 'accepted', emailVerificationRequired: true },
      202,
    );
  }

  const simple = SIMPLE_ROUTES.find(([suffix]) => url.endsWith(suffix));

  return simple ? simple[1]() : jsonResponse({ code: 'not_found' }, 404);
}

/**
 * Мини-API для тестов: /me и refresh отвечают 401, пока user не задан.
 * Логин по умолчанию успешен и возвращает demoUser.
 */
export function mockApi(options: ApiMockOptions = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    options.onRequest?.(String(input), init);
    return Promise.resolve(route(input, options));
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
