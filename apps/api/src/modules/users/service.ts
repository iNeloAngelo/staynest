import type { UpdateMeInput, UserDto } from '@staynest/shared';
import type { DbExecutor } from '../../platform/db/index';
import {
  findUserByEmail,
  findUserById,
  insertUser,
  lockUserRow,
  markEmailVerified,
  updateAvatarKey,
  updatePasswordHash,
  updateUserProfile,
} from './repo';
import type { CreateUserInput, ProfilePatch, UserRow } from './repo';

export type { CreateUserInput, ProfilePatch, UserRow } from './repo';

function toLocale(value: string): 'ru' | 'en' {
  return value === 'en' ? 'en' : 'ru';
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

/** Публичный URL аватара: ключ хранится в БД, путь раздачи задаётся окружением. */
function avatarUrl(key: string | null, publicPath: string): string | null {
  return key === null ? null : `${publicPath}/${encodeKey(key)}`;
}

export function toUserDto(row: UserRow, publicPath = '/media'): UserDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    phone: row.phone,
    avatarKey: row.avatar_key,
    avatarUrl: avatarUrl(row.avatar_key, publicPath),
    locale: toLocale(row.locale),
    emailVerified: row.email_verified_at !== null,
    createdAt: row.created_at.toISOString(),
  };
}

function toProfilePatch(input: UpdateMeInput): ProfilePatch {
  const patch: ProfilePatch = {};
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.locale !== undefined) patch.locale = input.locale;
  return patch;
}

/**
 * Публичный интерфейс модуля users. Таблицей `users` владеет только этот модуль;
 * auth вызывает эти функции и передаёт транзакцию явно.
 */
export const usersService = {
  findById(executor: DbExecutor, id: string): Promise<UserRow | undefined> {
    return findUserById(executor, id);
  },

  findAuthByEmail(executor: DbExecutor, email: string): Promise<UserRow | undefined> {
    return findUserByEmail(executor, email);
  },

  create(executor: DbExecutor, input: CreateUserInput): Promise<UserRow> {
    return insertUser(executor, input);
  },

  lockById(executor: DbExecutor, id: string): Promise<string | undefined> {
    return lockUserRow(executor, id);
  },

  updateProfile(executor: DbExecutor, id: string, input: UpdateMeInput): Promise<UserRow> {
    return updateUserProfile(executor, id, toProfilePatch(input));
  },

  markEmailVerified(executor: DbExecutor, id: string, at: Date): Promise<UserRow> {
    return markEmailVerified(executor, id, at);
  },

  setPasswordHash(executor: DbExecutor, id: string, passwordHash: string): Promise<void> {
    return updatePasswordHash(executor, id, passwordHash);
  },

  setAvatarKey(executor: DbExecutor, id: string, key: string | null): Promise<UserRow> {
    return updateAvatarKey(executor, id, key);
  },
};
