import webpush from 'web-push';
import type { Logger } from 'pino';
import type { PushConfig } from '../../platform/config/index';
import { errorCode } from '../../platform/errors/code';

export type PushMessage = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushSendResult =
  { ok: true } | { ok: false; gone: boolean; code: string; statusCode?: number };

export type PushSender = {
  readonly enabled: boolean;
  readonly publicKey: string | null;
  send(target: PushTarget, message: PushMessage): Promise<PushSendResult>;
};

const TTL_SECONDS = 3_600;
const PUSH_TIMEOUT_MS = 10_000;
const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
];

export function isAllowedPushHost(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;

    return ALLOWED_PUSH_HOSTS.some(
      (allowed) => url.hostname === allowed || url.hostname.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

function disabledSender(): PushSender {
  return {
    enabled: false,
    publicKey: null,
    send: async () => ({ ok: false, gone: false, code: 'push_disabled' }),
  };
}

/**
 * Web Push через VAPID. Ключи задаются только в .env; без них push выключен,
 * а остальные уведомления (in-app и SSE) продолжают работать.
 */
export function createPushSender(config: PushConfig, logger: Logger): PushSender {
  if (!config.enabled || !config.publicKey || !config.privateKey) return disabledSender();

  try {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  } catch (error) {
    logger.error({ code: errorCode(error) }, 'invalid VAPID keys, push disabled');
    return disabledSender();
  }

  return {
    enabled: true,
    publicKey: config.publicKey,
    async send(target, message) {
      if (!isAllowedPushHost(target.endpoint)) {
        return { ok: false, gone: false, code: 'push_host_not_allowed' };
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          JSON.stringify(message),
          { TTL: TTL_SECONDS, urgency: 'normal', timeout: PUSH_TIMEOUT_MS },
        );

        return { ok: true };
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : undefined;
        const gone = statusCode === 404 || statusCode === 410;

        return {
          ok: false,
          gone,
          code: statusCode ? `push_${statusCode}` : 'push_failed',
          ...(statusCode ? { statusCode } : {}),
        };
      }
    },
  };
}
