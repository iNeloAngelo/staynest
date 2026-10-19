import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  ResendVerificationInput,
  ResetPasswordInput,
} from '@staynest/shared';
import { usersService } from '../users/index';
import { RESET_PASSWORD_TTL_MS, VERIFY_EMAIL_TTL_MS } from './constants';
import { currentPasswordInvalid, invalidLinkToken } from './errors';
import {
  findAuthTokenByHash,
  findAuthTokenByHashForUpdate,
  insertAuthToken,
  invalidateAuthTokens,
  markAuthTokenUsed,
  revokeAllSessions,
} from './repo';
import type { AuthRuntime } from './service-context';
import {
  assertPolicy,
  enforce,
  rejectPasswordChange,
  sendResetEmail,
  sendVerificationEmail,
  waitAtLeast,
} from './service-context';
import type { SessionMeta } from './session';
import { generateOpaqueToken, hashToken } from './tokens';

export async function verifyEmail(
  runtime: AuthRuntime,
  token: string,
  password: string,
): Promise<void> {
  const tokenHash = hashToken(token);
  const issuedAt = runtime.now();
  const candidate = await findAuthTokenByHash(runtime.db.kysely, tokenHash, 'verify_email');
  if (!candidate || candidate.used_at !== null || candidate.expires_at <= issuedAt) {
    throw invalidLinkToken();
  }

  const user = await usersService.findById(runtime.db.kysely, candidate.user_id);
  if (!user || !user.is_active || user.deleted_at !== null) throw invalidLinkToken();

  assertPolicy(runtime, password, user);
  const passwordHash = await runtime.hasher.hash(password);

  const ok = await runtime.db.kysely.transaction().execute(async (trx) => {
    const locked = await usersService.lockById(trx, user.id);
    if (!locked) return false;

    const row = await findAuthTokenByHashForUpdate(trx, tokenHash, 'verify_email');
    if (!row || row.used_at !== null || row.expires_at <= issuedAt || row.user_id !== user.id) {
      return false;
    }

    await usersService.setPasswordHash(trx, user.id, passwordHash);
    await markAuthTokenUsed(trx, row.id, issuedAt);
    if (user.email_verified_at === null) {
      await usersService.markEmailVerified(trx, user.id, issuedAt);
    }
    await revokeAllSessions(trx, user.id, issuedAt);
    return true;
  });

  if (!ok) throw invalidLinkToken();
}

export async function resendVerification(
  runtime: AuthRuntime,
  input: ResendVerificationInput,
  meta: SessionMeta,
): Promise<void> {
  const startedAt = runtime.now().getTime();
  enforce(runtime, `resend:ip:${meta.ip ?? 'unknown'}`, runtime.limits.resendIp);
  const canSend = runtime.limiter.check(
    `resend:email:${input.email}:${meta.ip ?? 'unknown'}`,
    runtime.limits.resendEmail,
  ).allowed;

  const user = await usersService.findAuthByEmail(runtime.db.kysely, input.email);

  if (
    canSend &&
    user &&
    user.is_active &&
    user.deleted_at === null &&
    user.password_hash !== null &&
    user.email_verified_at === null
  ) {
    const issuedAt = runtime.now();
    const token = generateOpaqueToken();

    const created = await runtime.db.kysely.transaction().execute(async (trx) => {
      const locked = await usersService.lockById(trx, user.id);
      if (!locked) return false;
      const fresh = await usersService.findById(trx, user.id);
      if (
        !fresh ||
        !fresh.is_active ||
        fresh.password_hash === null ||
        fresh.email_verified_at !== null ||
        fresh.deleted_at !== null
      ) {
        return false;
      }

      await invalidateAuthTokens(trx, user.id, 'verify_email', issuedAt);
      await insertAuthToken(trx, {
        userId: user.id,
        kind: 'verify_email',
        tokenHash: hashToken(token),
        expiresAt: new Date(issuedAt.getTime() + VERIFY_EMAIL_TTL_MS),
      });
      return true;
    });

    if (created) await sendVerificationEmail(runtime, user, token);
  }

  await waitAtLeast(runtime, startedAt);
}

export async function requestPasswordReset(
  runtime: AuthRuntime,
  input: ForgotPasswordInput,
  meta: SessionMeta,
): Promise<void> {
  enforce(runtime, `reset:ip:${meta.ip ?? 'unknown'}`, runtime.limits.resetIp);
  const canSend = runtime.limiter.check(
    `reset:email:${input.email}:${meta.ip ?? 'unknown'}`,
    runtime.limits.resetEmail,
  ).allowed;

  const startedAt = runtime.now().getTime();
  const user = await usersService.findAuthByEmail(runtime.db.kysely, input.email);

  if (
    canSend &&
    user &&
    user.is_active &&
    user.deleted_at === null &&
    user.password_hash !== null
  ) {
    const issuedAt = runtime.now();
    const token = generateOpaqueToken();

    const created = await runtime.db.kysely.transaction().execute(async (trx) => {
      const locked = await usersService.lockById(trx, user.id);
      if (!locked) return false;
      const fresh = await usersService.findById(trx, user.id);
      if (
        !fresh ||
        !fresh.is_active ||
        fresh.deleted_at !== null ||
        fresh.password_hash !== user.password_hash
      ) {
        return false;
      }

      await invalidateAuthTokens(trx, user.id, 'reset_password', issuedAt);
      await insertAuthToken(trx, {
        userId: user.id,
        kind: 'reset_password',
        tokenHash: hashToken(token),
        expiresAt: new Date(issuedAt.getTime() + RESET_PASSWORD_TTL_MS),
      });
      return true;
    });

    if (created) await sendResetEmail(runtime, user, token);
  }

  await waitAtLeast(runtime, startedAt);
  runtime.logger.info({ event: 'auth.password_reset_requested' }, 'password reset handled');
}

export async function resetPassword(
  runtime: AuthRuntime,
  input: ResetPasswordInput,
  meta: SessionMeta,
): Promise<void> {
  enforce(runtime, `reset:ip:${meta.ip ?? 'unknown'}`, runtime.limits.resetIp);
  const tokenHash = hashToken(input.token);
  const candidate = await findAuthTokenByHash(runtime.db.kysely, tokenHash, 'reset_password');
  const issuedAt = runtime.now();

  if (!candidate || candidate.used_at !== null || candidate.expires_at <= issuedAt) {
    throw invalidLinkToken();
  }

  const user = await usersService.findById(runtime.db.kysely, candidate.user_id);
  if (!user || !user.is_active || user.deleted_at !== null) throw invalidLinkToken();

  assertPolicy(runtime, input.password, user);
  const passwordHash = await runtime.hasher.hash(input.password);

  const ok = await runtime.db.kysely.transaction().execute(async (trx) => {
    const locked = await usersService.lockById(trx, user.id);
    if (!locked) return false;

    const row = await findAuthTokenByHashForUpdate(trx, tokenHash, 'reset_password');
    if (!row || row.used_at !== null || row.expires_at <= issuedAt || row.user_id !== user.id) {
      return false;
    }

    await usersService.setPasswordHash(trx, user.id, passwordHash);
    await markAuthTokenUsed(trx, row.id, issuedAt);
    await invalidateAuthTokens(trx, user.id, 'reset_password', issuedAt);
    if (user.email_verified_at === null) {
      await usersService.markEmailVerified(trx, user.id, issuedAt);
    }
    await revokeAllSessions(trx, user.id, issuedAt);
    return true;
  });

  if (!ok) throw invalidLinkToken();
  runtime.logger.info({ event: 'auth.password_reset' }, 'password reset completed');
}

export async function changePassword(
  runtime: AuthRuntime,
  userId: string,
  input: ChangePasswordInput,
  meta: SessionMeta,
): Promise<void> {
  enforce(runtime, `change-password:ip:${meta.ip ?? 'unknown'}`, runtime.limits.changePasswordIp);

  const user = await usersService.findById(runtime.db.kysely, userId);
  if (!user || !user.is_active || user.deleted_at !== null || user.password_hash === null) {
    throw currentPasswordInvalid();
  }

  const valid = await runtime.hasher.verify(user.password_hash, input.currentPassword);
  if (!valid) return rejectPasswordChange(runtime, userId);

  runtime.throttle.reset(`change-password:${userId}`);
  assertPolicy(runtime, input.newPassword, user);
  const passwordHash = await runtime.hasher.hash(input.newPassword);
  const issuedAt = runtime.now();

  await runtime.db.kysely.transaction().execute(async (trx) => {
    await usersService.lockById(trx, user.id);
    const fresh = await usersService.findById(trx, user.id);
    if (!fresh || fresh.password_hash !== user.password_hash) throw currentPasswordInvalid();

    await usersService.setPasswordHash(trx, user.id, passwordHash);
    await invalidateAuthTokens(trx, user.id, 'reset_password', issuedAt);
    await revokeAllSessions(trx, user.id, issuedAt);
  });

  runtime.logger.info({ event: 'auth.password_changed' }, 'password changed');
}
