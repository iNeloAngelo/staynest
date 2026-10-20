import type { FastifyRequest } from 'fastify';
import { AppError } from './errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SAFE_FETCH_SITES = new Set(['same-origin', 'same-site', 'none']);
/** Вебхуки защищены HMAC-подписью, а не cookie: Origin у провайдера свой. */
const SIGNED_WEBHOOK_PATH = /^\/api\/v1\/payments\/webhook\/mock$/;
/** Vite на Windows слушает 127.0.0.1 и может занять любой свободный порт. */
const LOOPBACK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/;

export type OriginGuardOptions = {
  /**
   * В development/preview разрешать любой loopback-origin. CORS_ORIGINS при этом
   * остаётся явным для production; послабление не действует при NODE_ENV=production.
   */
  allowLoopback?: boolean;
};

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
  options: OriginGuardOptions = {},
): (request: FastifyRequest) => Promise<void> {
  return async (request) => {
    if (SAFE_METHODS.has(request.method)) return;
    if (SIGNED_WEBHOOK_PATH.test(request.url)) return;

    const origin = request.headers.origin;
    // Браузер может прислать `Origin: null` для same-origin form POST
    // (например, hosted-страница без action). В этом случае решение
    // принимает Fetch Metadata, который JS подделать не может.
    const opaqueOrigin = origin === 'null';
    const loopbackAllowed = options.allowLoopback === true && LOOPBACK_ORIGIN.test(origin ?? '');
    if (origin && !opaqueOrigin && !allowedOrigins.includes(origin) && !loopbackAllowed) {
      throw forbidden('Запрос с недопустимого источника отклонён.');
    }

    const fetchSite = request.headers['sec-fetch-site'];
    if (typeof fetchSite === 'string' && !SAFE_FETCH_SITES.has(fetchSite)) {
      throw forbidden('Межсайтовый запрос отклонён.');
    }
  };
}
