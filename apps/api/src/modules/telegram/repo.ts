import type { Selectable } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';
import type { TelegramIdentities } from '../../platform/db/schema.generated';

export type TelegramIdentityRow = Selectable<TelegramIdentities>;

export function findIdentityByTelegramId(
  executor: DbExecutor,
  telegramId: string,
): Promise<TelegramIdentityRow | undefined> {
  return executor
    .selectFrom('telegram_identities')
    .selectAll()
    .where('telegram_id', '=', telegramId)
    .executeTakeFirst();
}

export function findIdentityByUserId(
  executor: DbExecutor,
  userId: string,
): Promise<TelegramIdentityRow | undefined> {
  return executor
    .selectFrom('telegram_identities')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();
}

export async function insertIdentity(
  executor: DbExecutor,
  input: { userId: string; telegramId: string; username: string | null },
): Promise<TelegramIdentityRow> {
  return executor
    .insertInto('telegram_identities')
    .values({
      user_id: input.userId,
      telegram_id: input.telegramId,
      username: input.username,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateIdentityUsername(
  executor: DbExecutor,
  telegramId: string,
  username: string | null,
): Promise<void> {
  await executor
    .updateTable('telegram_identities')
    .set({ username })
    .where('telegram_id', '=', telegramId)
    .execute();
}

/** Чат для уведомлений: null, если пользователь не привязывал Telegram. */
export async function findTelegramChatId(
  executor: DbExecutor,
  userId: string,
): Promise<string | null> {
  const row = await executor
    .selectFrom('telegram_identities')
    .select('telegram_id')
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return row?.telegram_id ?? null;
}
