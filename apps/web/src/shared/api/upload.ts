import { API_BASE } from './base';
import { ApiError, statusCodeFor } from './errors';
import type { ProblemDetails } from './errors';
import { refreshSession } from './session';

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
    problem.code ?? statusCodeFor(xhr.status),
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
export async function uploadRequest<T>(
  path: string,
  form: FormData,
  options: UploadOptions,
): Promise<T> {
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
