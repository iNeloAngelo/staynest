import type { Selectable, Updateable } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';
import type { Users } from '../../platform/db/schema.generated';

export type UserRow = Selectable<Users>;

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  displayName: string;
  locale: 'ru' | 'en';
  emailVerifiedAt?: Date;
};

export type ProfilePatch = {
  display_name?: string;
  phone?: string | null;
  locale?: 'ru' | 'en';
};

export function findUserById(executor: DbExecutor, id: string): Promise<UserRow | undefined> {
  return executor.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
}

export function findUserByEmail(executor: DbExecutor, email: string): Promise<UserRow | undefined> {
  return executor.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
}

export async function insertUser(executor: DbExecutor, input: CreateUserInput): Promise<UserRow> {
  return executor
    .insertInto('users')
    .values({
      email: input.email,
      password_hash: input.passwordHash,
      display_name: input.displayName,
      locale: input.locale,
      ...(input.emailVerifiedAt ? { email_verified_at: input.emailVerifiedAt } : {}),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function lockUserRow(executor: DbExecutor, id: string): Promise<string | undefined> {
  const row = await executor
    .selectFrom('users')
    .select('id')
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst();

  return row?.id;
}

export async function updateUserProfile(
  executor: DbExecutor,
  id: string,
  patch: ProfilePatch,
): Promise<UserRow> {
  const update: Updateable<Users> = {};

  if (patch.display_name !== undefined) update.display_name = patch.display_name;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.locale !== undefined) update.locale = patch.locale;

  return executor
    .updateTable('users')
    .set(update)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function markEmailVerified(
  executor: DbExecutor,
  id: string,
  at: Date,
): Promise<UserRow> {
  return executor
    .updateTable('users')
    .set({ email_verified_at: at })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updatePasswordHash(
  executor: DbExecutor,
  id: string,
  passwordHash: string,
): Promise<void> {
  await executor
    .updateTable('users')
    .set({ password_hash: passwordHash })
    .where('id', '=', id)
    .execute();
}

export async function updateAvatarKey(
  executor: DbExecutor,
  id: string,
  avatarKey: string | null,
): Promise<UserRow> {
  return executor
    .updateTable('users')
    .set({ avatar_key: avatarKey })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}
