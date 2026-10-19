import { describe, expect, it } from 'vitest';
import { checkPasswordPolicy, createPasswordHasher } from './password';

const identity = { email: 'anna@example.ru', displayName: 'Анна' };

describe('checkPasswordPolicy', () => {
  it('отклоняет короткий и слишком длинный пароль', () => {
    expect(checkPasswordPolicy('short', identity)).toBe('too_short');
    expect(checkPasswordPolicy('x'.repeat(129), identity)).toBe('too_long');
  });

  it('отклоняет пароль из списка распространённых', () => {
    expect(checkPasswordPolicy('1234567890', identity)).toBe('common');
    expect(checkPasswordPolicy('QWERTYUIOP', identity)).toBe('common');
  });

  it('отклоняет пароль с email или именем', () => {
    expect(checkPasswordPolicy('anna-Strong-2026', identity)).toBe('contains_identity');
    expect(checkPasswordPolicy('Anna-Strong-2026', identity)).toBe('contains_identity');
  });

  it('пропускает нормальный пароль', () => {
    expect(checkPasswordPolicy('Forest-Lake-2026', identity)).toBeNull();
  });
});

describe('createPasswordHasher', () => {
  const hasher = createPasswordHasher({ memoryCost: 19_456, timeCost: 2, parallelism: 1 });

  it('создаёт argon2id-хэш и проверяет пароль', async () => {
    const hash = await hasher.hash('Forest-Lake-2026');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(hasher.verify(hash, 'Forest-Lake-2026')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'Wrong-Password-2026')).resolves.toBe(false);
  });

  it('возвращает false на битом хэше, а не падает', async () => {
    await expect(hasher.verify('not-a-hash', 'Forest-Lake-2026')).resolves.toBe(false);
  });

  it('тратит время на проверку несуществующего пользователя', async () => {
    await expect(hasher.verifyDummy('Forest-Lake-2026')).resolves.toBe(false);
  });
});
