type ProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly errors?: unknown;

  constructor(status: number, code: string, detail: string, errors?: unknown) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.errors = errors;
  }
}

const API_BASE = '/api/v1';

type RequestOptions = {
  /** Повторять запрос после обновления сессии. Для /me и auth-эндпоинтов выключено. */
  authRetry?: boolean;
  headers?: HeadersInit;
};

const STATUS_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  422: 'validation_error',
  429: 'rate_limited',
  500: 'internal_error',
};

type RefreshOutcome =
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
    if (response.status === 401 || response.status === 403) return { kind: 'unauthenticated' };

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
 * Promise живёт снаружи Web Locks, чтобы параллельные 401 внутри вкладки
 * делили один вызов, а не выстраивались в очередь из N refresh.
 *
 * Между вкладками один cookie-jar и один refresh-токен, поэтому само обновление
 * дополнительно сериализуем через Web Locks. Без API локов остаётся same-tab версия.
 */
function refreshSession(): Promise<RefreshOutcome> {
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

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);

  if (!headers.has('accept')) headers.set('accept', 'application/json');

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body !== undefined && !isFormData && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return headers;
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return {};
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const problem = await readProblem(response);
  const code = problem.code ?? STATUS_CODES[response.status] ?? 'http_error';
  const detail = problem.detail ?? `HTTP ${response.status}`;

  return new ApiError(response.status, code, detail, problem.errors);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
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
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'DELETE' }, options),
  upload: <T>(path: string, form: FormData, options: UploadOptions = {}) =>
    uploadRequest<T>(path, form, options),
};

export type UploadOptions = {
  /** Прогресс отправки 0–100. */
  onProgress?: (percent: number) => void;
};

function parseUploadBody(xhr: XMLHttpRequest): unknown {
  const text = xhr.responseText;
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function uploadError(xhr: XMLHttpRequest): ApiError {
  const contentType = xhr.getResponseHeader('content-type') ?? '';
  let problem: ProblemDetails = {};

  if (
    contentType.includes('application/problem+json') ||
    contentType.includes('application/json')
  ) {
    try {
      problem = JSON.parse(xhr.responseText) as ProblemDetails;
    } catch {
      problem = {};
    }
  }

  return new ApiError(
    xhr.status,
    problem.code ?? STATUS_CODES[xhr.status] ?? 'http_error',
    problem.detail ?? `HTTP ${xhr.status}`,
    problem.errors,
  );
}

function sendUpload<T>(path: string, form: FormData, options: UploadOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('accept', 'application/json');

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      options.onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
        resolve(parseUploadBody(xhr) as T);
        return;
      }

      reject(uploadError(xhr));
    });

    xhr.addEventListener('error', () => {
      reject(new ApiError(0, 'network_error', 'Нет связи с сервером.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new ApiError(0, 'upload_aborted', 'Загрузка отменена.'));
    });

    xhr.send(form);
  });
}

/**
 * Загрузка файла идёт через XHR: fetch не умеет отдавать прогресс отправки.
 * При 401 обновляем сессию тем же single-flight механизмом, что и JSON-запросы.
 */
async function uploadRequest<T>(path: string, form: FormData, options: UploadOptions): Promise<T> {
  try {
    return await sendUpload<T>(path, form, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const outcome = await refreshSession();
      if (outcome.kind === 'ok') {
        options.onProgress?.(0);
        return sendUpload<T>(path, form, options);
      }
      if (outcome.kind === 'error') throw outcome.error;
    }

    throw error;
  }
}

export const queryKeys = {
  me: ['me'] as const,
};
