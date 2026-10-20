import type { Logger } from 'pino';
import type { TelegramConfig } from '../../platform/config/telegram';

const API_BASE = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_MESSAGE_LENGTH = 4000;

type InlineButton = { text: string; web_app?: { url: string }; url?: string };
export type TelegramKeyboard = { inline_keyboard: InlineButton[][] };

type TelegramSendResult = { ok: true } | { ok: false; code: string };

export type TelegramBot = {
  readonly enabled: boolean;
  sendMessage(
    chatId: string,
    text: string,
    keyboard?: TelegramKeyboard,
  ): Promise<TelegramSendResult>;
};

type TelegramMessage = { title: string; body: string; url?: string };

export type TelegramSender = {
  readonly enabled: boolean;
  send(chatId: string, message: TelegramMessage): Promise<TelegramSendResult>;
};

function disabledBot(): TelegramBot {
  return {
    enabled: false,
    sendMessage: async () => ({ ok: false, code: 'telegram_disabled' }),
  };
}

async function callBotApi(
  token: string,
  method: string,
  payload: unknown,
  logger: Logger,
): Promise<TelegramSendResult> {
  try {
    const response = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error({ event: 'telegram.api_error', method, status: response.status });
      return { ok: false, code: `telegram_${response.status}` };
    }

    const body = (await response.json().catch(() => null)) as { ok?: unknown } | null;
    if (body?.ok !== true) {
      logger.error({ event: 'telegram.api_rejected', method });
      return { ok: false, code: 'telegram_rejected' };
    }

    return { ok: true };
  } catch (error) {
    logger.error({
      event: 'telegram.api_failed',
      method,
      code: error instanceof Error ? error.name : 'unknown',
    });
    return { ok: false, code: 'telegram_unreachable' };
  }
}

/**
 * Тонкая обёртка над Bot API. Токен живёт только в замыкании и никогда
 * не попадает в лог; ошибки логируются без тела запроса и ответа.
 */
export function createTelegramBot(config: TelegramConfig, logger: Logger): TelegramBot {
  const token = config.botToken;
  if (!config.enabled || !token) return disabledBot();

  return {
    enabled: true,
    async sendMessage(chatId, text, keyboard) {
      return callBotApi(
        token,
        'sendMessage',
        {
          chat_id: chatId,
          text: text.slice(0, MAX_MESSAGE_LENGTH),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...(keyboard ? { reply_markup: keyboard } : {}),
        },
        logger,
      );
    },
  };
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function webAppKeyboard(url: string): TelegramKeyboard | undefined {
  if (!url.startsWith('https://')) return undefined;
  return { inline_keyboard: [[{ text: 'Открыть StayNest', web_app: { url } }]] };
}

/** Sender для сервиса уведомлений: заголовок жирным, ссылка — кнопкой Mini App. */
export function createTelegramSender(bot: TelegramBot): TelegramSender {
  return {
    enabled: bot.enabled,
    async send(chatId, message) {
      const text = `<b>${escapeHtml(message.title)}</b>\n${escapeHtml(message.body)}`;
      const keyboard = message.url ? webAppKeyboard(message.url) : undefined;
      return bot.sendMessage(chatId, text, keyboard);
    },
  };
}

export function startMessage(): { text: string; keyboard?: TelegramKeyboard } {
  return {
    text: [
      '<b>StayNest</b> — дома у леса и озера.',
      'Откройте приложение, чтобы найти дом или сдать свой: свободные даты, честная цена и бронирование без переписок.',
    ].join('\n\n'),
  };
}
