import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { TelegramInitDataError } from './errors';

const MAX_CLOCK_SKEW_SECONDS = 300;
const HEX_SHA256 = /^[0-9a-f]{64}$/;

const telegramUserSchema = z
  .object({
    id: z.number().int().positive(),
    first_name: z.string().trim().min(1).max(128),
    last_name: z.string().trim().max(128).optional(),
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]{3,32}$/)
      .optional(),
    language_code: z.string().trim().max(16).optional(),
    photo_url: z.string().url().max(2048).optional(),
  })
  .passthrough();

export type TelegramProfile = {
  telegramId: string;
  displayName: string;
  username: string | null;
  locale: 'ru' | 'en';
};

export type VerifyInitDataOptions = {
  botToken: string;
  maxAgeSeconds: number;
  now: Date;
};

function fail(reason: string): never {
  throw new TelegramInitDataError(reason);
}

/**
 * Строка для HMAC: все поля кроме hash, отсортированные по имени.
 * Дубликаты запрещены: иначе проверка подписи и разбор разойдутся.
 */
export function buildDataCheckString(params: URLSearchParams): string {
  const seen = new Set<string>();
  const entries: Array<[string, string]> = [];

  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    if (seen.has(key)) fail(`duplicate_field:${key}`);
    seen.add(key);
    entries.push([key, value]);
  }

  entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return entries.map(([key, value]) => `${key}=${value}`).join('\n');
}

/** Подпись из документации Telegram: HMAC(HMAC("WebAppData", bot_token), data_check_string). */
export function signInitData(dataCheckString: string, botToken: string): string {
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  return createHmac('sha256', secret).update(dataCheckString).digest('hex');
}

function assertSignature(params: URLSearchParams, botToken: string): void {
  const hash = params.get('hash')?.toLowerCase();
  if (!hash || !HEX_SHA256.test(hash)) fail('missing_hash');

  const expected = signInitData(buildDataCheckString(params), botToken);
  const actual = Buffer.from(hash, 'hex');
  const computed = Buffer.from(expected, 'hex');

  if (actual.length !== computed.length || !timingSafeEqual(actual, computed)) {
    fail('bad_signature');
  }
}

function assertFresh(params: URLSearchParams, maxAgeSeconds: number, now: Date): void {
  const raw = params.get('auth_date');
  if (!raw || !/^\d{1,12}$/.test(raw)) fail('bad_auth_date');

  const authDate = Number(raw);
  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (authDate > nowSeconds + MAX_CLOCK_SKEW_SECONDS) fail('auth_date_in_future');
  if (nowSeconds - authDate > maxAgeSeconds) fail('auth_date_expired');
}

function parseProfile(params: URLSearchParams): TelegramProfile {
  const raw = params.get('user');
  if (!raw) fail('missing_user');

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    fail('bad_user_json');
  }

  const parsed = telegramUserSchema.safeParse(json);
  if (!parsed.success) fail('bad_user');

  const user = parsed.data;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  const displayName = (fullName || user.username || `Telegram ${user.id}`).slice(0, 80);

  return {
    telegramId: String(user.id),
    displayName,
    username: user.username ?? null,
    locale: user.language_code === 'en' ? 'en' : 'ru',
  };
}

/**
 * Проверяет подпись и свежесть initData. Любая ошибка — TelegramInitDataError
 * с технической причиной; наружу отдаётся единый 401 без подробностей.
 */
export function verifyInitData(
  raw: string,
  { botToken, maxAgeSeconds, now }: VerifyInitDataOptions,
): TelegramProfile {
  const params = new URLSearchParams(raw);
  if (params.size === 0) fail('empty');

  assertSignature(params, botToken);
  assertFresh(params, maxAgeSeconds, now);
  return parseProfile(params);
}
