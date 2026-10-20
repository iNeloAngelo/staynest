import { z } from 'zod';

const DEV_TELEGRAM_BOT_TOKEN_PREFIX = 'dev-only-';

export const telegramEnvSchema = z.object({
  /**
   * Без токена интеграция выключена целиком: вебхук не регистрируется,
   * /auth/telegram отвечает 503, уведомления в Telegram не отправляются.
   */
  TELEGRAM_BOT_TOKEN: z.string().trim().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,256}$/, 'TELEGRAM_WEBHOOK_SECRET: 32–256 символов A-Za-z0-9_-')
      .optional(),
  ),
  TELEGRAM_INITDATA_MAX_AGE_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
});

export type TelegramEnv = z.infer<typeof telegramEnvSchema>;

export type TelegramConfig = {
  /** Без токена бота Mini App не может войти, а вебхук и уведомления выключены. */
  enabled: boolean;
  botToken: string | null;
  /** Secret token из setWebhook: по нему Telegram подтверждает подлинность запроса. */
  webhookSecret: string | null;
  /** Свежесть auth_date в initData. */
  initDataMaxAgeSeconds: number;
};

export function telegramConfig(data: TelegramEnv): TelegramConfig {
  const botToken = data.TELEGRAM_BOT_TOKEN?.trim() || null;

  return {
    enabled: botToken !== null,
    botToken,
    webhookSecret: data.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
    initDataMaxAgeSeconds: data.TELEGRAM_INITDATA_MAX_AGE_SECONDS,
  };
}

/**
 * В production токен бота без webhook-секрета — это открытый вебхук.
 * Проверка fail-closed: лучше не стартовать, чем принимать поддельные update.
 */
export function assertTelegramProductionConfig(env: NodeJS.ProcessEnv, data: TelegramEnv): void {
  if (!data.TELEGRAM_BOT_TOKEN?.trim()) return;

  if (!env.TELEGRAM_WEBHOOK_SECRET?.trim()) {
    throw new Error('В production обязательны переменные окружения: TELEGRAM_WEBHOOK_SECRET');
  }
  if (data.TELEGRAM_BOT_TOKEN.trim().startsWith(DEV_TELEGRAM_BOT_TOKEN_PREFIX)) {
    throw new Error('TELEGRAM_BOT_TOKEN не должен быть dev-заглушкой в production.');
  }
  if (data.TELEGRAM_WEBHOOK_SECRET?.trim().startsWith(DEV_TELEGRAM_BOT_TOKEN_PREFIX)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET не должен совпадать с dev-значением.');
  }
}
