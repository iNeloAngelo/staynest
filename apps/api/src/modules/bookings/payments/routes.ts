import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { MockPaymentWebhook } from '@staynest/shared';
import type { AppConfig } from '../../../platform/config/index';
import type { Db } from '../../../platform/db/index';
import type { AuthContext } from '../../../platform/http/auth-context';
import { AppError } from '../../../platform/http/errors';
import { parseInput } from '../../../platform/http/validate';
import { createAuthGuard } from '../../auth/index';
import { createDepositService } from './service';
import type { PaymentRuntime } from './context';
import { createPaymentRuntime } from './context';
import { findPaymentSession } from './repo';
import type { PaymentSessionRow } from './repo';
import { paymentPage } from './page';
import {
  MOCK_SIGNATURE_HEADER,
  signMockWebhook,
  verifyMockWebhook,
} from './provider';

const paramsSchema = z.object({ id: z.uuid() }).strict();
const tokenParamsSchema = z.object({ token: z.string().min(8).max(200) }).strict();

type PaymentRoutesOptions = {
  config: AppConfig;
  db: Db;
  now?: () => Date;
};

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'private, no-store');
  reply.header('pragma', 'no-cache');
}

function actorOf(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw new AppError({
      status: 401,
      code: 'unauthorized',
      title: 'Unauthorized',
      detail: 'Требуется авторизация.',
    });
  }
  return request.auth;
}

function signatureOf(request: FastifyRequest): string | undefined {
  const raw = request.headers[MOCK_SIGNATURE_HEADER];
  return Array.isArray(raw) ? raw[0] : raw;
}

function rawBodyOf(request: FastifyRequest): Buffer {
  if (Buffer.isBuffer(request.body)) return request.body;
  return Buffer.from(typeof request.body === 'string' ? request.body : '', 'utf8');
}

function isExpired(dueAt: Date | null, now: Date): boolean {
  return dueAt !== null && dueAt.getTime() <= now.getTime();
}

function bookingUrl(config: AppConfig, bookingId: string, result: string): string {
  return `${config.webAppUrl}/bookings/${bookingId}?payment=${result}`;
}

function processedMessage(session: PaymentSessionRow, expired: boolean): string {
  if (expired) return 'Срок оплаты депозита истёк. Бронь будет отменена.';
  if (session.status === 'failed') return 'Платёж не прошёл. Вернитесь к брони и попробуйте снова.';
  if (session.status === 'refunded') return 'Депозит возвращён, повторная оплата не нужна.';
  return 'Депозит уже оплачен, повторная оплата не нужна.';
}

async function renderPage(
  runtime: PaymentRuntime,
  token: string,
  reply: FastifyReply,
): Promise<FastifyReply> {
  noStore(reply);
  const session = await findPaymentSession(runtime.db.kysely, token);
  if (!session) {
    return reply.status(404).type('text/html; charset=utf-8').send(
      paymentPage({ state: 'unavailable', message: 'Платёж не найден.' }),
    );
  }

  const back = bookingUrl(runtime.config, session.booking_id, 'back');
  const expired = isExpired(session.deposit_due_at, runtime.now());
  if (session.status !== 'created' || session.booking_status !== 'confirmed' || expired) {
    return reply.type('text/html; charset=utf-8').send(
      paymentPage({
        state: 'processed',
        bookingUrl: back,
        message: processedMessage(session, expired),
      }),
    );
  }

  return reply.type('text/html; charset=utf-8').send(
    paymentPage({
      state: 'payable',
      title: session.listing_title,
      amountMinor: Number(session.amount_minor),
      currency: session.currency.trim(),
      checkIn: session.check_in,
      checkOut: session.check_out,
      dueAt: session.deposit_due_at,
      timeZone: runtime.config.listingTimeZone,
    }),
  );
}

function registerMockPage(app: FastifyInstance, runtime: PaymentRuntime): void {
  app.get('/mock-payments/:token', { logLevel: 'warn' }, async (request, reply) => {
    const { token } = parseInput(tokenParamsSchema, request.params);
    reply.header('referrer-policy', 'no-referrer');
    return renderPage(runtime, token, reply);
  });

  app.post('/mock-payments/:token', { logLevel: 'warn' }, async (request, reply) => {
    const { token } = parseInput(tokenParamsSchema, request.params);
    reply.header('referrer-policy', 'no-referrer');
    const form = new URLSearchParams(rawBodyOf(request).toString('utf8'));
    const result = form.get('result') === 'fail' ? 'failed' : 'succeeded';
    const session = await findPaymentSession(runtime.db.kysely, token);
    if (!session) {
      noStore(reply);
      return reply.status(404).type('text/html; charset=utf-8').send(
        paymentPage({ state: 'unavailable', message: 'Платёж не найден.' }),
      );
    }
    if (session.status !== 'created' || isExpired(session.deposit_due_at, runtime.now())) {
      return reply.redirect(bookingUrl(runtime.config, session.booking_id, 'done'), 303);
    }

    const event: MockPaymentWebhook = {
      externalId: token,
      status: result,
      amountMinor: Number(session.amount_minor),
      currency: session.currency.trim(),
      occurredAt: runtime.now().toISOString(),
    };
    const raw = JSON.stringify(event);
    const verified = verifyMockWebhook(
      runtime.config.payments.webhookSecret,
      raw,
      signMockWebhook(runtime.config.payments.webhookSecret, raw),
    );
    const service = createDepositService(runtime);
    await service.handleWebhook(verified);

    return reply.redirect(
      bookingUrl(runtime.config, session.booking_id, result === 'succeeded' ? 'success' : 'failed'),
      303,
    );
  });
}

function registerWebhook(app: FastifyInstance, runtime: PaymentRuntime): void {
  app.post('/payments/webhook/mock', { logLevel: 'warn' }, async (request, reply) => {
    noStore(reply);
    const signature = signatureOf(request);
    const raw = rawBodyOf(request);
    const event = verifyMockWebhook(runtime.config.payments.webhookSecret, raw, signature);
    const service = createDepositService(runtime);
    return reply.send(await service.handleWebhook(event));
  });
}

function registerDepositRoute(app: FastifyInstance, runtime: PaymentRuntime): void {
  const guard = createAuthGuard({ db: runtime.db, config: runtime.config });
  const service = createDepositService(runtime);

  app.post('/bookings/:id/deposit', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(paramsSchema, request.params);
    return reply.send(await service.start(actorOf(request).userId, id));
  });
}

export const paymentRoutes: FastifyPluginAsync<PaymentRoutesOptions> = async (app, options) => {
  const runtime = createPaymentRuntime({ db: options.db, config: options.config, now: options.now });

  // Сырое тело нужно для проверки HMAC; парсеры живут только в этом плагине
  // и не меняют разбор JSON в остальных маршрутах бронирования.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => {
      done(null, body);
    },
  );

  registerDepositRoute(app, runtime);
  // Выключенный мок не должен оставлять публичные маршруты, которые могут
  // пометить платёж оплаченным серверным секретом.
  if (!runtime.config.payments.mockEnabled) return;
  registerWebhook(app, runtime);
  registerMockPage(app, runtime);
};
