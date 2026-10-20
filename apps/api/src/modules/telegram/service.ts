import type { UserDto } from '@staynest/shared';
import type { Logger } from 'pino';
import type { AppConfig } from '../../platform/config/index';
import type { Db, DbExecutor } from '../../platform/db/index';
import { FixedWindowRateLimiter } from '../../platform/http/rate-limit';
import { createSessionManager } from '../auth/index';
import type { IssuedTokens, SessionMeta } from '../auth/index';
import { toUserDto, usersService } from '../users/index';
import type { UserRow } from '../users/index';
import {
  TelegramInitDataError,
  invalidInitData,
  telegramAccountInactive,
  telegramNotConfigured,
  telegramRateLimited,
} from './errors';
import {
  findIdentityByTelegramId,
  findIdentityByUserId,
  insertIdentity,
  updateIdentityUsername,
} from './repo';
import { verifyInitData } from './validation';
import type { TelegramProfile } from './validation';

const SYNTHETIC_EMAIL_DOMAIN = 'telegram.invalid';
const AUTH_RATE_LIMIT = { max: 20, windowMs: 10 * 60 * 1000 };

export type TelegramServiceDependencies = {
  db: Db;
  config: AppConfig;
  logger: Logger;
  now?: () => Date;
};

export type TelegramAuthResult = { user: UserDto; tokens: IssuedTokens };

type Runtime = {
  db: Db;
  config: AppConfig;
  logger: Logger;
  now: () => Date;
  limiter: FixedWindowRateLimiter;
  sessions: ReturnType<typeof createSessionManager>;
};

function syntheticEmail(telegramId: string): string {
  return `tg${telegramId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function assertActive(user: UserRow | undefined): UserRow {
  if (!user || !user.is_active || user.deleted_at !== null) throw telegramAccountInactive();
  return user;
}

async function createAccount(
  executor: DbExecutor,
  profile: TelegramProfile,
  createdAt: Date,
): Promise<UserRow> {
  const user = await usersService.create(executor, {
    email: syntheticEmail(profile.telegramId),
    passwordHash: null,
    displayName: profile.displayName,
    locale: profile.locale,
    // Telegram уже подтвердил личность; отдельное письмо не нужно.
    emailVerifiedAt: createdAt,
  });

  await insertIdentity(executor, {
    userId: user.id,
    telegramId: profile.telegramId,
    username: profile.username,
  });

  return user;
}

async function findKnownUser(
  executor: DbExecutor,
  profile: TelegramProfile,
): Promise<UserRow | undefined> {
  const identity = await findIdentityByTelegramId(executor, profile.telegramId);
  if (!identity) return undefined;

  if (identity.username !== profile.username) {
    await updateIdentityUsername(executor, profile.telegramId, profile.username);
  }

  return assertActive(await usersService.findById(executor, identity.user_id));
}

async function loadOrCreate(runtime: Runtime, profile: TelegramProfile): Promise<UserRow> {
  const known = await findKnownUser(runtime.db.kysely, profile);
  if (known) return known;

  try {
    return await runtime.db.kysely
      .transaction()
      .execute((trx) => createAccount(trx, profile, runtime.now()));
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Параллельный запрос успел создать аккаунт: читаем его, а не падаем.
    return assertActive(await findKnownUser(runtime.db.kysely, profile));
  }
}

function enforceRateLimit(runtime: Runtime, meta: SessionMeta): void {
  const decision = runtime.limiter.check(`telegram:${meta.ip ?? 'unknown'}`, AUTH_RATE_LIMIT);
  if (!decision.allowed) throw telegramRateLimited(decision.retryAfterSeconds);
}

async function authenticate(
  runtime: Runtime,
  rawInitData: string,
  meta: SessionMeta,
): Promise<TelegramAuthResult> {
  const { enabled, botToken, initDataMaxAgeSeconds } = runtime.config.telegram;
  if (!enabled || !botToken) throw telegramNotConfigured();

  enforceRateLimit(runtime, meta);

  let profile: TelegramProfile;
  try {
    profile = verifyInitData(rawInitData, {
      botToken,
      maxAgeSeconds: initDataMaxAgeSeconds,
      now: runtime.now(),
    });
  } catch (error) {
    if (!(error instanceof TelegramInitDataError)) throw error;
    runtime.logger.warn({ event: 'telegram.auth_rejected', reason: error.reason });
    throw invalidInitData();
  }

  const user = await loadOrCreate(runtime, profile);
  const tokens = await runtime.sessions.issue(user, meta);
  runtime.logger.info({ event: 'telegram.login' }, 'telegram login ok');

  return { user: toUserDto(user, runtime.config.storage.publicPath), tokens };
}

async function chatIdFor(runtime: Runtime, userId: string): Promise<string | null> {
  const identity = await findIdentityByUserId(runtime.db.kysely, userId);
  return identity?.telegram_id ?? null;
}

export function createTelegramService({
  db,
  config,
  logger,
  now = () => new Date(),
}: TelegramServiceDependencies) {
  const runtime: Runtime = {
    db,
    config,
    logger,
    now,
    limiter: new FixedWindowRateLimiter(() => now().getTime()),
    sessions: createSessionManager({ db, config, now }),
  };

  return {
    enabled: config.telegram.enabled,
    authenticate: (rawInitData: string, meta: SessionMeta) =>
      authenticate(runtime, rawInitData, meta),
    chatIdFor: (userId: string) => chatIdFor(runtime, userId),
  };
}
