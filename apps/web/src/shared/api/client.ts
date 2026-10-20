import { API_BASE } from './base';
import { ApiError, parseResponse, toApiError } from './errors';
import { refreshSession } from './session';
import { streamRequest } from './stream';
import type { StreamOptions } from './stream';
import { uploadRequest } from './upload';
import type { UploadOptions } from './upload';

type RequestOptions = {
  /** Повторять запрос после обновления сессии. Для /me и auth-эндпоинтов выключено. */
  authRetry?: boolean;
  headers?: HeadersInit;
};

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);

  if (!headers.has('accept')) headers.set('accept', 'application/json');

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body !== undefined && !isFormData && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return headers;
}

async function request<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions = {},
): Promise<T> {
  const authRetry = options.authRetry ?? true;
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: buildHeaders({ ...init, headers: options.headers ?? init.headers }),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Нет связи с сервером.');
  }

  const isAuthPath = path.startsWith('/auth/');
  if (response.status === 401 && authRetry && !isAuthPath) {
    const outcome = await refreshSession();

    if (outcome.kind === 'ok') {
      return request<T>(path, init, { ...options, authRetry: false });
    }

    // 5xx/сеть при refresh — это не «гость», а сбой: пусть useMe покажет ошибку.
    if (outcome.kind === 'error') throw outcome.error;
  }

  if (!response.ok) throw await toApiError(response);

  return parseResponse<T>(response);
}

function withBody(method: string, body?: unknown): RequestInit {
  return {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { method: 'GET' }, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, withBody('POST', body), options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, withBody('PATCH', body), options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, withBody('PUT', body), options),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, withBody('DELETE', body), options),
  upload: <T>(path: string, form: FormData, options: UploadOptions = {}) =>
    uploadRequest<T>(path, form, options),
  stream: (path: string, options: StreamOptions) => streamRequest(path, options),
};

export const queryKeys = {
  me: ['me'] as const,
};

export { ApiError } from './errors';
export type { StreamOptions } from './stream';
export type { UploadOptions } from './upload';
