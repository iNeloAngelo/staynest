import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mockPaymentWebhookSchema } from '@staynest/shared';
import type { MockPaymentWebhook } from '@staynest/shared';
import { invalidPaymentPayload, invalidPaymentSignature } from './errors';

export const MOCK_PROVIDER = 'mock';
export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

/** Сессия провайдера: случайный opaque-токен, а не id платежа. */
export function createMockSessionId(): string {
  return randomBytes(24).toString('base64url');
}

export function signMockWebhook(secret: string, rawBody: string | Buffer): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

function sameSignature(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Проверяет подпись по сырому телу (а не по пересобранному JSON), затем
 * разбирает событие. Лишние поля, включая карточные, отвергаются strict-схемой.
 */
export function verifyMockWebhook(
  secret: string,
  rawBody: string | Buffer,
  signature: string | undefined,
): MockPaymentWebhook {
  if (!signature || signature.trim() === '') throw invalidPaymentSignature();
  if (!sameSignature(signMockWebhook(secret, rawBody), signature.trim())) {
    throw invalidPaymentSignature();
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody);
  } catch {
    throw invalidPaymentPayload();
  }

  const parsed = mockPaymentWebhookSchema.safeParse(parsedBody);
  if (!parsed.success) throw invalidPaymentPayload();
  return parsed.data;
}

export function mockPaymentUrl(sessionId: string): string {
  return `/api/v1/mock-payments/${encodeURIComponent(sessionId)}`;
}
