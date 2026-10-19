import type { FastifyRequest } from 'fastify';
import { AppError } from './errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SAFE_FETCH_SITES = new Set(['same-origin', 'same-site', 'none']);

function forbidden(message: string): AppError {
  return new AppError({
    status: 403,
    code: 'origin_not_allowed',
    title: 'Forbidden',
    detail: message,
  });
}

/**
 * Защита от CSRF для cookie-аутентификации: небезопасные методы принимаются
 * только с разрешённого Origin (или без Origin — для curl и серверных клиентов),
 * а `Sec-Fetch-Site` не должен сообщать о межсайтовом запросе.
 */
export function createOriginGuard(
  allowedOrigins: readonly string[],
): (request: FastifyRequest) => Promise<void> {
  return async (request) => {
    if (SAFE_METHODS.has(request.method)) return;

    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      throw forbidden('Запрос с недопустимого источника отклонён.');
    }

    const fetchSite = request.headers['sec-fetch-site'];
    if (typeof fetchSite === 'string' && !SAFE_FETCH_SITES.has(fetchSite)) {
      throw forbidden('Межсайтовый запрос отклонён.');
    }
  };
}
