import type { Locale } from '@staynest/shared';
import type { Logger } from 'pino';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { EventBus } from '../../platform/events/index';
import type { Mailer, MailMessage } from '../../platform/mailer/index';
import type { UserRow } from '../users/index';
import { accountExistsEmail, resetPasswordEmail, verificationEmail } from './emails';
import type { EmailContent } from './emails';
import { invalidCredentials, currentPasswordInvalid, rateLimited, weakPassword } from './errors';
import { checkPasswordPolicy, createPasswordHasher } from './password';
import type { PasswordHasher } from './password';
import { DEFAULT_AUTH_RATE_LIMITS, FixedWindowRateLimiter } from './rate-limit';
import type { AuthRateLimits, RateLimitRule } from './rate-limit';
import { createSessionManager } from './session';
import type { SessionManager } from './session';
import { LoginThrottle, progressiveDelayMs } from './throttle';

const DEFAULT_MINIMUM_RESPONSE_MS = 250;
const DEFAULT_MAIL_BUDGET_MS = 200;

export type AuthOptions = {
  rateLimits?: Partial<AuthRateLimits>;
  sleep?: (ms: number) => Promise<void>;
  minimumResponseMs?: number;
  mailBudgetMs?: number;
  now?: () => Date;
};

export type AuthServiceDependencies = {
  db: Db;
  logger: Logger;
  mailer: Mailer;
  events: EventBus;
  config: AppConfig;
  options?: AuthOptions;
};

export type AuthRuntime = {
  db: Db;
  logger: Logger;
  mailer: Mailer;
  events: EventBus;
  config: AppConfig;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  minimumResponseMs: number;
  mailBudgetMs: number;
  limits: AuthRateLimits;
  limiter: FixedWindowRateLimiter;
  throttle: LoginThrottle;
  hasher: PasswordHasher;
  sessions: SessionManager;
};

export function createAuthRuntime({
  db,
  logger,
  mailer,
  events,
  config,
  options = {},
}: AuthServiceDependencies): AuthRuntime {
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  return {
    db,
    logger,
    mailer,
    events,
    config,
    now,
    sleep,
    minimumResponseMs: options.minimumResponseMs ?? DEFAULT_MINIMUM_RESPONSE_MS,
    mailBudgetMs: options.mailBudgetMs ?? DEFAULT_MAIL_BUDGET_MS,
    limits: { ...DEFAULT_AUTH_RATE_LIMITS, ...options.rateLimits },
    limiter: new FixedWindowRateLimiter(() => now().getTime()),
    throttle: new LoginThrottle(() => now().getTime()),
    hasher: createPasswordHasher(config.auth.argon2),
    sessions: createSessionManager({ db, config, now }),
  };
}

export function localeOf(value: string): Locale {
  return value === 'en' ? 'en' : 'ru';
}

export function enforce(runtime: AuthRuntime, key: string, rule: RateLimitRule): void {
  const decision = runtime.limiter.check(key, rule);
  if (!decision.allowed) throw rateLimited(decision.retryAfterSeconds);
}

export function assertPolicy(
  runtime: AuthRuntime,
  password: string,
  user: Pick<UserRow, 'email' | 'display_name'>,
): void {
  const problem = checkPasswordPolicy(password, {
    email: user.email,
    displayName: user.display_name,
  });
  if (problem) throw weakPassword(problem);
}

function emailMessage(to: string, content: EmailContent, tag: string): MailMessage {
  return { to, subject: content.subject, text: content.text, html: content.html, tag };
}

async function sendMail(runtime: AuthRuntime, message: MailMessage): Promise<void> {
  const delivery = runtime.mailer.send(message).catch(() => undefined);
  // Не держим HTTP-запрос на медленном SMTP: письмо продолжит отправляться в фоне,
  // а ответ не выдаст существование email по времени (floor задаёт waitAtLeast).
  await Promise.race([delivery, runtime.sleep(runtime.mailBudgetMs)]);
}

export async function sendVerificationEmail(
  runtime: AuthRuntime,
  user: UserRow,
  token: string,
): Promise<void> {
  const content = verificationEmail(localeOf(user.locale), runtime.config.webAppUrl, token);
  await sendMail(runtime, emailMessage(user.email, content, 'verify_email'));
}

export async function sendResetEmail(
  runtime: AuthRuntime,
  user: UserRow,
  token: string,
): Promise<void> {
  const content = resetPasswordEmail(localeOf(user.locale), runtime.config.webAppUrl, token);
  await sendMail(runtime, emailMessage(user.email, content, 'reset_password'));
}

export async function sendAccountExistsEmail(runtime: AuthRuntime, user: UserRow): Promise<void> {
  const content = accountExistsEmail(localeOf(user.locale), runtime.config.webAppUrl);
  await sendMail(runtime, emailMessage(user.email, content, 'account_exists'));
}

export async function waitAtLeast(runtime: AuthRuntime, startedAt: number): Promise<void> {
  const elapsed = runtime.now().getTime() - startedAt;
  if (elapsed < runtime.minimumResponseMs) await runtime.sleep(runtime.minimumResponseMs - elapsed);
}

export async function rejectLogin(
  runtime: AuthRuntime,
  email: string,
  reason: string,
  emailLimitExceeded = false,
): Promise<never> {
  const failures = runtime.throttle.recordFailure(email);
  runtime.logger.info({ event: 'auth.login_failed', reason }, 'login failed');
  const delay = emailLimitExceeded ? progressiveDelayMs(1_000) : progressiveDelayMs(failures);
  if (delay > 0) await runtime.sleep(delay);
  throw invalidCredentials();
}

export async function rejectPasswordChange(runtime: AuthRuntime, userId: string): Promise<never> {
  const failures = runtime.throttle.recordFailure(`change-password:${userId}`);
  runtime.logger.info({ event: 'auth.password_change_failed' }, 'password change failed');
  const delay = progressiveDelayMs(failures);
  if (delay > 0) await runtime.sleep(delay);
  throw currentPasswordInvalid();
}
