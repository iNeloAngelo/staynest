import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  SessionDto,
  UpdateMeInput,
  UserDto,
} from '@staynest/shared';
import type { AuthContext } from '../../platform/http/auth-context';
import { toUserDto, usersService } from '../users/index';
import type { UserRow } from '../users/index';
import {
  changePassword,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from './account-flows';
import { VERIFY_EMAIL_TTL_MS } from './constants';
import { emailNotVerified, invalidRefreshToken, unauthorized } from './errors';
import { insertAuthToken } from './repo';
import type { AuthRuntime, AuthServiceDependencies } from './service-context';
import {
  assertPolicy,
  createAuthRuntime,
  enforce,
  localeOf,
  rejectLogin,
  sendAccountExistsEmail,
  sendVerificationEmail,
  waitAtLeast,
} from './service-context';
import type { IssuedTokens, SessionMeta } from './session';
import { generateOpaqueToken, hashToken } from './tokens';

export type LoginResult = { user: UserDto; tokens: IssuedTokens };

type VerificationOutcome = { created: boolean; user: UserRow | null; token?: string };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

async function commitVerification(
  runtime: AuthRuntime,
  input: RegisterInput,
  allowCreate: boolean,
): Promise<VerificationOutcome> {
  const passwordHash = await runtime.hasher.hash(input.password);
  const issuedAt = runtime.now();
  const autoVerified = !runtime.config.auth.requireEmailVerification;

  try {
    return await runtime.db.kysely.transaction().execute(async (trx) => {
      const existing = await usersService.findAuthByEmail(trx, input.email);
      if (existing) return { created: false, user: existing };
      if (!allowCreate) return { created: false, user: null };

      const user = await usersService.create(trx, {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        locale: input.locale,
        ...(autoVerified ? { emailVerifiedAt: issuedAt } : {}),
      });

      if (autoVerified) return { created: true, user };

      const token = generateOpaqueToken();
      await insertAuthToken(trx, {
        userId: user.id,
        kind: 'verify_email',
        tokenHash: hashToken(token),
        expiresAt: new Date(issuedAt.getTime() + VERIFY_EMAIL_TTL_MS),
      });

      return { created: true, user, token };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await usersService.findAuthByEmail(runtime.db.kysely, input.email);
    if (!existing) throw error;
    return { created: false, user: existing };
  }
}

async function notifyRegistration(
  runtime: AuthRuntime,
  outcome: VerificationOutcome,
  canSend: boolean,
): Promise<void> {
  if (!outcome.user) return;

  if (outcome.created && outcome.token && canSend) {
    await sendVerificationEmail(runtime, outcome.user, outcome.token);
    return;
  }

  if (
    !outcome.created &&
    canSend &&
    outcome.user.is_active &&
    outcome.user.deleted_at === null &&
    outcome.user.password_hash !== null
  ) {
    await sendAccountExistsEmail(runtime, outcome.user);
  }
}

async function register(
  runtime: AuthRuntime,
  input: RegisterInput,
  meta: SessionMeta,
): Promise<{ created: boolean; emailVerificationRequired: boolean }> {
  const startedAt = runtime.now().getTime();
  assertPolicy(runtime, input.password, {
    email: input.email,
    display_name: input.displayName,
  });

  enforce(runtime, `register:ip:${meta.ip ?? 'unknown'}`, runtime.limits.registerIp);
  const canSend = runtime.limiter.check(
    `register:email:${input.email}:${meta.ip ?? 'unknown'}`,
    runtime.limits.registerEmail,
  ).allowed;

  const outcome = await commitVerification(runtime, input, canSend);
  await notifyRegistration(runtime, outcome, canSend);

  if (outcome.created && outcome.user) {
    runtime.events.publish('user.registered', {
      userId: outcome.user.id,
      locale: localeOf(outcome.user.locale),
      occurredAt: runtime.now().toISOString(),
    });
  }

  await waitAtLeast(runtime, startedAt);
  runtime.logger.info({ event: 'auth.registered', created: outcome.created }, 'register handled');
  return {
    created: outcome.created,
    emailVerificationRequired: runtime.config.auth.requireEmailVerification,
  };
}

async function login(
  runtime: AuthRuntime,
  input: LoginInput,
  meta: SessionMeta,
): Promise<LoginResult> {
  enforce(runtime, `login:ip:${meta.ip ?? 'unknown'}`, runtime.limits.loginIp);
  const emailKey = `login:email:${input.email}`;
  const emailAllowed = runtime.limiter.check(emailKey, runtime.limits.loginEmail).allowed;

  const user = await usersService.findAuthByEmail(runtime.db.kysely, input.email);
  if (!user || user.password_hash === null) {
    await runtime.hasher.verifyDummy(input.password);
    return rejectLogin(runtime, input.email, 'unknown_email', !emailAllowed);
  }

  const valid = await runtime.hasher.verify(user.password_hash, input.password);
  if (!valid) return rejectLogin(runtime, input.email, 'bad_password', !emailAllowed);
  if (!user.is_active || user.deleted_at !== null) {
    return rejectLogin(runtime, input.email, 'inactive', !emailAllowed);
  }
  if (runtime.config.auth.requireEmailVerification && user.email_verified_at === null) {
    runtime.throttle.reset(input.email);
    runtime.limiter.reset(emailKey);
    throw emailNotVerified();
  }

  runtime.throttle.reset(input.email);
  runtime.limiter.reset(emailKey);
  const tokens = await runtime.sessions.issue(user, meta);
  runtime.logger.info({ event: 'auth.login' }, 'login ok');

  return { user: toUserDto(user), tokens };
}

async function refresh(
  runtime: AuthRuntime,
  rawRefreshToken: string | undefined,
  meta: SessionMeta,
): Promise<LoginResult> {
  if (!rawRefreshToken) throw invalidRefreshToken();
  const result = await runtime.sessions.rotate(rawRefreshToken, meta);
  return { user: toUserDto(result.user), tokens: result.tokens };
}

async function getMe(runtime: AuthRuntime, userId: string): Promise<UserDto> {
  const user = await usersService.findById(runtime.db.kysely, userId);
  if (!user || !user.is_active || user.deleted_at !== null) throw unauthorized();
  return toUserDto(user);
}

async function updateMe(
  runtime: AuthRuntime,
  userId: string,
  input: UpdateMeInput,
): Promise<UserDto> {
  await getMe(runtime, userId);
  const updated = await usersService.updateProfile(runtime.db.kysely, userId, input);
  return toUserDto(updated);
}

async function revokeAll(runtime: AuthRuntime, userId: string): Promise<void> {
  await runtime.sessions.revokeAll(userId);
  runtime.logger.info({ event: 'auth.sessions_revoked' }, 'all sessions revoked');
}

export function createAuthService(deps: AuthServiceDependencies) {
  const runtime = createAuthRuntime(deps);

  return {
    register: (input: RegisterInput, meta: SessionMeta) => register(runtime, input, meta),
    login: (input: LoginInput, meta: SessionMeta) => login(runtime, input, meta),
    refresh: (raw: string | undefined, meta: SessionMeta) => refresh(runtime, raw, meta),
    logout: (rawRefresh: string | undefined, rawAccess: string | undefined) =>
      runtime.sessions.logout(rawRefresh, rawAccess),
    authenticate: (raw: string | undefined): Promise<AuthContext> =>
      runtime.sessions.authenticate(raw),
    getMe: (userId: string) => getMe(runtime, userId),
    updateMe: (userId: string, input: UpdateMeInput) => updateMe(runtime, userId, input),
    listSessions: (userId: string, currentSessionId: string): Promise<SessionDto[]> =>
      runtime.sessions.list(userId, currentSessionId),
    revokeAllSessions: (userId: string) => revokeAll(runtime, userId),
    verifyEmail: (token: string, password: string) => verifyEmail(runtime, token, password),
    resendVerification: (input: ResendVerificationInput, meta: SessionMeta) =>
      resendVerification(runtime, input, meta),
    requestPasswordReset: (input: ForgotPasswordInput, meta: SessionMeta) =>
      requestPasswordReset(runtime, input, meta),
    resetPassword: (input: ResetPasswordInput, meta: SessionMeta) =>
      resetPassword(runtime, input, meta),
    changePassword: (userId: string, input: ChangePasswordInput, meta: SessionMeta) =>
      changePassword(runtime, userId, input, meta),
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
