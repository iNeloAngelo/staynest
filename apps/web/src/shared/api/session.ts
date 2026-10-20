import { API_BASE } from './base';
import { ApiError, toApiError } from './errors';

export type RefreshOutcome =
  { kind: 'ok' } | { kind: 'unauthenticated' } | { kind: 'error'; error: ApiError };

let refreshInFlight: Promise<RefreshOutcome> | null = null;

async function performRefresh(): Promise<RefreshOutcome> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });

    if (response.ok) return { kind: 'ok' };
    if (response.status === 401 || response.status === 403) {
      // Тело 401 не нужно, но невычитанный body оставляет соединение занятым
      // и мешает network idle (Lighthouse, e2e).
      await response.text();
      return { kind: 'unauthenticated' };
    }

    return { kind: 'error', error: await toApiError(response) };
  } catch {
    return {
      kind: 'error',
      error: new ApiError(0, 'network_error', 'Нет связи с сервером.'),
    };
  }
}

/**
 * Same-tab single-flight: параллельные 401 ждут один запрос, иначе второй
 * refresh считался бы повторным использованием токена и отзывал всю family.
 * Между вкладками обновление сериализуется через Web Locks.
 */
export function refreshSession(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;

  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  // lib.dom типизирует callback как синхронный, но Web Locks принимает Promise.
  type LockRequest = (
    name: string,
    callback: () => Promise<RefreshOutcome>,
  ) => Promise<RefreshOutcome>;
  const refresh: Promise<RefreshOutcome> = locks
    ? (locks.request as unknown as LockRequest).bind(locks)('staynest-refresh', performRefresh)
    : performRefresh();
  const pending = refresh.finally(() => {
    refreshInFlight = null;
  });

  refreshInFlight = pending;
  return pending;
}
