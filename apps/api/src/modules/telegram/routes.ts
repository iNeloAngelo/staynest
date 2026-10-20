import { timingSafeEqual } from 'node:crypto';
import { telegramAuthInputSchema } from '@staynest/shared';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import { parseInput } from '../../platform/http/validate';
import { setSessionCookies } from '../auth/index';
import type { SessionMeta } from '../auth/index';
import { createTelegramBot } from './bot';
import type { TelegramBot } from './bot';
import { invalidWebhookSecret } from './errors';
import { createTelegramService } from './service';
import { handleStart, parseStart } from './webhook';

const WEBHOOK_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

export type TelegramRoutesOptions = {
  config: AppConfig;
  db: Db;
  logger: Logger;
  bot?: TelegramBot;
};

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'private, no-store');
  reply.header('pragma', 'no-cache');
}

function metaOf(request: FastifyRequest): SessionMeta {
  return {
    ip: request.ip || null,
    userAgent: request.headers['user-agent'] ?? null,
  };
}

function secretMatches(header: string | undefined, expected: string): boolean {
  if (!header) return false;
  const actual = Buffer.from(header);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function registerAuthRoute(
  app: FastifyInstance,
  service: ReturnType<typeof createTelegramService>,
  config: AppConfig,
): void {
  app.post('/auth/telegram', async (request, reply) => {
    noStore(reply);
    const input = parseInput(telegramAuthInputSchema, request.body);
    const result = await service.authenticate(input.initData, metaOf(request));
    setSessionCookies(reply, result.tokens, config);
    return reply.send({ user: result.user });
  });
}

function registerWebhookRoute(app: FastifyInstance, bot: TelegramBot, config: AppConfig): void {
  const expected = config.telegram.webhookSecret;
  if (!expected || !config.telegram.enabled) return;

  app.post('/telegram/webhook', async (request, reply) => {
    noStore(reply);
    const raw = request.headers[WEBHOOK_SECRET_HEADER];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!secretMatches(header, expected)) {
      throw invalidWebhookSecret();
    }

    const start = parseStart(request.body);
    if (start) await handleStart(bot, start, config.webAppUrl);

    // Остальные update игнорируем: Telegram повторит запрос при не-200.
    return reply.send({ ok: true });
  });
}

export const telegramRoutes: FastifyPluginAsync<TelegramRoutesOptions> = async (app, options) => {
  const bot = options.bot ?? createTelegramBot(options.config.telegram, options.logger);
  const service = createTelegramService({
    db: options.db,
    config: options.config,
    logger: options.logger,
  });

  registerAuthRoute(app, service, options.config);

  if (options.config.telegram.enabled && !options.config.telegram.webhookSecret) {
    options.logger.warn('TELEGRAM_BOT_TOKEN задан без TELEGRAM_WEBHOOK_SECRET: вебхук выключен');
  }

  registerWebhookRoute(app, bot, options.config);
};
