import { hash, verify } from '@node-rs/argon2';
import type { Argon2Config } from '../../platform/config/index';
import { COMMON_PASSWORDS } from './data/common-passwords.generated';

export type PasswordPolicyError = 'too_short' | 'too_long' | 'common' | 'contains_identity';

export type PasswordIdentity = {
  email: string;
  displayName: string;
};

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;
const MIN_IDENTITY_LENGTH = 3;

function normalizedIdentity(value: string): string {
  return value.toLowerCase().replace(/[\s._-]+/g, '');
}

/**
 * Проверка политики пароля. Список распространённых паролей — локальный
 * (SecLists 10k), чтобы проверка не зависела от сети и работала в тестах.
 */
export function checkPasswordPolicy(
  password: string,
  identity: PasswordIdentity,
): PasswordPolicyError | null {
  if (password.length < MIN_LENGTH) return 'too_short';
  if (password.length > MAX_LENGTH) return 'too_long';

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'common';

  const emailLocal = identity.email.split('@')[0]?.toLowerCase() ?? '';
  const name = normalizedIdentity(identity.displayName);
  const passwordNormalized = normalizedIdentity(password);

  if (emailLocal.length >= MIN_IDENTITY_LENGTH && lower.includes(emailLocal)) {
    return 'contains_identity';
  }
  if (name.length >= MIN_IDENTITY_LENGTH && passwordNormalized.includes(name)) {
    return 'contains_identity';
  }

  return null;
}

export type PasswordHasher = {
  hash: (password: string) => Promise<string>;
  verify: (passwordHash: string, password: string) => Promise<boolean>;
  verifyDummy: (password: string) => Promise<boolean>;
};

export function createPasswordHasher(config: Argon2Config): PasswordHasher {
  const options = {
    memoryCost: config.memoryCost,
    timeCost: config.timeCost,
    parallelism: config.parallelism,
  };

  // Прогреваем фиктивный хэш сразу: первый логин с несуществующим email
  // не должен быть заметно медленнее последующих.
  const dummyHash = hash('dummy-password-for-timing-equalization', options);

  return {
    hash(password) {
      return hash(password, options);
    },
    async verify(passwordHash, password) {
      try {
        return await verify(passwordHash, password);
      } catch {
        return false;
      }
    },
    async verifyDummy(password) {
      return verify(await dummyHash, password).catch(() => false);
    },
  };
}
