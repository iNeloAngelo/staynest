export const PRIVATE_CACHE_CONTROL = 'private, no-store';

/**
 * Персональные ответы (`/me`, включая SSE и push-конфиг) не должны попадать
 * в HTTP-кэш браузера или общий прокси. Service Worker кэширует их отдельно
 * и чистит при выходе (features/pwa/model/cleanup.ts).
 */
export function isPrivateApiUrl(rawUrl: string): boolean {
  let path: string;

  try {
    path = new URL(rawUrl, 'http://staynest.local').pathname;
  } catch {
    return false;
  }

  return path === '/api/v1/me' || path === '/api/v1/me/' || path.startsWith('/api/v1/me/');
}
