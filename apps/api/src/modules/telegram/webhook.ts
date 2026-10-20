import { z } from 'zod';
import { startMessage, webAppKeyboard } from './bot';
import type { TelegramBot, TelegramKeyboard } from './bot';

const updateSchema = z
  .object({
    message: z
      .object({
        text: z.string().max(4096).optional(),
        chat: z.object({ id: z.number().int() }),
      })
      .optional(),
  })
  .passthrough();

export type StartCommand = { chatId: string };

/** Разбирает только нужную часть update; всё остальное Telegram присылает зря. */
export function parseStart(body: unknown): StartCommand | null {
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return null;

  const message = parsed.data.message;
  if (!message?.text) return null;

  const command = message.text.trim().split(/\s+/)[0]?.toLowerCase().split('@')[0];
  if (command !== '/start') return null;

  return { chatId: String(message.chat.id) };
}

export async function handleStart(
  bot: TelegramBot,
  command: StartCommand,
  appUrl: string,
): Promise<void> {
  const { text } = startMessage();
  const keyboard: TelegramKeyboard | undefined = webAppKeyboard(appUrl);
  await bot.sendMessage(command.chatId, text, keyboard);
}
