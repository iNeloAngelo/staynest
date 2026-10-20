import { z } from 'zod';

/**
 * `initData` приходит из Telegram WebApp. Ограничение сверху защищает
 * от раздутых тел запросов: реальный initData обычно короче 1 КБ.
 */
export const TELEGRAM_INIT_DATA_MAX = 8192;

export const telegramAuthInputSchema = z
  .object({
    initData: z.string().trim().min(1).max(TELEGRAM_INIT_DATA_MAX),
  })
  .strict();

export type TelegramAuthInput = z.infer<typeof telegramAuthInputSchema>;
