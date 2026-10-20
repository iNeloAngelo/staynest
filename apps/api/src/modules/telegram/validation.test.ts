import { describe, expect, it } from 'vitest';
import { TelegramInitDataError } from './errors';
import { buildDataCheckString, signInitData, verifyInitData } from './validation';

const TOKEN = '123456:test-bot-token';
const NOW = new Date('2026-10-20T12:00:00Z');
const MAX_AGE = 3600;

type InitDataOverrides = {
  user?: Record<string, unknown>;
  authDate?: number;
  token?: string;
  extra?: Record<string, string>;
  duplicate?: [string, string];
};

function makeInitData(overrides: InitDataOverrides = {}): string {
  const params = new URLSearchParams();
  params.set('query_id', 'AAHtest');
  params.set(
    'user',
    JSON.stringify(
      overrides.user ?? {
        id: 123_456_789,
        first_name: 'Анна',
        last_name: 'Петрова',
        username: 'anna_p',
        language_code: 'ru',
      },
    ),
  );
  params.set('auth_date', String(overrides.authDate ?? Math.floor(NOW.getTime() / 1000)));

  for (const [key, value] of Object.entries(overrides.extra ?? {})) params.set(key, value);

  const hash = signInitData(buildDataCheckString(params), overrides.token ?? TOKEN);
  params.set('hash', hash);
  // Дубликат добавляем после подписи: проверка должна поймать его сама.
  if (overrides.duplicate) params.append(overrides.duplicate[0], overrides.duplicate[1]);
  return params.toString();
}

function verify(raw: string) {
  return verifyInitData(raw, { botToken: TOKEN, maxAgeSeconds: MAX_AGE, now: NOW });
}

describe('Telegram initData', () => {
  it('принимает корректную подпись и разбирает профиль', () => {
    const profile = verify(makeInitData());

    expect(profile).toEqual({
      telegramId: '123456789',
      displayName: 'Анна Петрова',
      username: 'anna_p',
      locale: 'ru',
    });
  });

  it('отвергает подделанного пользователя при старой подписи', () => {
    const raw = makeInitData();
    const params = new URLSearchParams(raw);
    params.set('user', JSON.stringify({ id: 999, first_name: 'Mallory' }));

    expect(() => verify(params.toString())).toThrow(TelegramInitDataError);
  });

  it('отвергает подпись другим токеном бота', () => {
    expect(() => verify(makeInitData({ token: '999:another-token' }))).toThrow(/bad_signature/);
  });

  it('отвергает просроченный auth_date', () => {
    const authDate = Math.floor(NOW.getTime() / 1000) - MAX_AGE - 1;
    expect(() => verify(makeInitData({ authDate }))).toThrow(/auth_date_expired/);
  });

  it('отвергает auth_date из будущего', () => {
    const authDate = Math.floor(NOW.getTime() / 1000) + 600;
    expect(() => verify(makeInitData({ authDate }))).toThrow(/auth_date_in_future/);
  });

  it('отвергает дубликат поля user', () => {
    const raw = makeInitData({ duplicate: ['user', JSON.stringify({ id: 5, first_name: 'X' })] });
    expect(() => verify(raw)).toThrow(/duplicate_field:user/);
  });

  it('отвергает некорректный профиль', () => {
    expect(() => verify(makeInitData({ user: { id: 1, first_name: '' } }))).toThrow(/bad_user/);
    expect(() => verify(makeInitData({ user: { first_name: 'Анна' } }))).toThrow(/bad_user/);
  });

  it('отвергает отсутствие hash и мусор', () => {
    expect(() => verify('')).toThrow(/empty/);
    expect(() => verify('user=%7B%7D&auth_date=1')).toThrow(/missing_hash/);
  });

  it('сортирует поля data_check_string стабильно', () => {
    const params = new URLSearchParams([
      ['b', '2'],
      ['a', '1'],
      ['c', '3'],
    ]);
    expect(buildDataCheckString(params)).toBe('a=1\nb=2\nc=3');
  });

  it('выбирает en для language_code=en', () => {
    const user = { id: 7, first_name: 'Ann', language_code: 'en' };
    expect(verify(makeInitData({ user })).locale).toBe('en');
  });
});
