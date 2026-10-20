import { describe, expect, it } from 'vitest';
import { loginInputSchema, registerInputSchema, updateMeInputSchema, userDtoSchema } from './auth';

describe('auth schemas', () => {
  it('нормализует email в регистрации', () => {
    const result = registerInputSchema.parse({
      email: '  User@Example.RU ',
      password: 'StrongPass-2026',
      displayName: '  Анна ',
    });

    expect(result.email).toBe('user@example.ru');
    expect(result.displayName).toBe('Анна');
    expect(result.locale).toBe('ru');
  });

  it('не даёт занять синтетический адрес Telegram', () => {
    const result = registerInputSchema.safeParse({
      email: 'tg123456789@telegram.invalid',
      password: 'StrongPass-2026',
      displayName: 'Маллори',
    });

    expect(result.success).toBe(false);
  });

  it('отвергает короткий пароль', () => {
    const result = registerInputSchema.safeParse({
      email: 'user@example.ru',
      password: 'short',
      displayName: 'Анна',
    });

    expect(result.success).toBe(false);
  });

  it('отвергает лишние поля в логине', () => {
    const result = loginInputSchema.safeParse({
      email: 'user@example.ru',
      password: 'StrongPass-2026',
      role: 'admin',
    });

    expect(result.success).toBe(false);
  });

  it('требует хотя бы одно поле в PATCH /me', () => {
    expect(updateMeInputSchema.safeParse({}).success).toBe(false);
    expect(updateMeInputSchema.safeParse({ locale: 'en' }).success).toBe(true);
  });

  it('проверяет формат даты в DTO пользователя', () => {
    const result = userDtoSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000000',
      email: 'user@example.ru',
      displayName: 'Анна',
      phone: null,
      avatarKey: null,
      locale: 'ru',
      emailVerified: false,
      createdAt: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });
});
