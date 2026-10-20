import type { SessionDto } from '@staynest/shared';
import type { AppConfig } from '../../platform/config/index';
import type { Db, DbExecutor } from '../../platform/db/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { toUserDto, usersService } from '../users/index';
import type { UserRow } from '../users/index';
import { invalidCredentials, invalidRefreshToken, unauthorized } from './errors';
import {
  findRefreshTokenByHash,
  findRefreshTokenByHashForUpdate,
  hasActiveSession,
  insertRefreshToken,
  listActiveSessions,
  revokeAllSessions,
  revokeFamily,
  revokeRefreshToken,
} from './repo';
import {
  generateOpaqueToken,
  hashToken,
  newFamilyId,
  signAccessToken,
  verifyAccessToken,
} from './tokens';

export type SessionMeta = {
  ip: string | null;
  userAgent: string | null;
};

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
};

type SessionDeps = {
  db: Db;
  config: AppConfig;
  now: () => Date;
};

type IssueInput = {
  user: UserRow;
  meta: SessionMeta;
  familyId: string;
  issuedAt: Date;
};

type RotateResult =
  | { kind: 'ok'; user: UserRow; tokens: IssuedTokens }
  | { kind: 'invalid' }
  | { kind: 'reuse' }
  | { kind: 'expired' };

const MAX_USER_AGENT_LENGTH = 300;

function sanitizeUserAgent(value: string | undefined): string | null {
  if (!value) return null;
  return value.slice(0, MAX_USER_AGENT_LENGTH);
}

function refreshExpiry(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

async function issueWith(
  deps: SessionDeps,
  executor: DbExecutor,
  input: IssueInput,
): Promise<IssuedTokens> {
  const rawRefreshToken = generateOpaqueToken();
  const refreshExpiresAt = refreshExpiry(input.issuedAt, deps.config.auth.refreshTokenTtlDays);

  await insertRefreshToken(executor, {
    userId: input.user.id,
    tokenHash: hashToken(rawRefreshToken),
    familyId: input.familyId,
    userAgent: sanitizeUserAgent(input.meta.userAgent ?? undefined),
    ip: input.meta.ip,
    expiresAt: refreshExpiresAt,
  });

  const accessToken = await signAccessToken(
    { sub: input.user.id, sid: input.familyId },
    deps.config.auth.accessTokenTtlSeconds,
    deps.config.auth.jwtSecret,
    input.issuedAt,
  );

  return { accessToken, refreshToken: rawRefreshToken };
}

async function issueSession(
  deps: SessionDeps,
  user: UserRow,
  meta: SessionMeta,
): Promise<IssuedTokens> {
  return deps.db.kysely.transaction().execute(async (trx) => {
    const locked = await usersService.lockById(trx, user.id);
    if (!locked) throw unauthorized();

    const fresh = await usersService.findById(trx, user.id);
    if (!fresh || !fresh.is_active || fresh.deleted_at !== null) throw unauthorized();
    if (fresh.password_hash !== user.password_hash) throw invalidCredentials();

    return issueWith(deps, trx, {
      user: fresh,
      meta,
      familyId: newFamilyId(),
      issuedAt: deps.now(),
    });
  });
}

async function rotateSession(
  deps: SessionDeps,
  rawRefreshToken: string,
  meta: SessionMeta,
): Promise<{ user: UserRow; tokens: IssuedTokens }> {
  const issuedAt = deps.now();
  const tokenHash = hashToken(rawRefreshToken);
  const candidate = await findRefreshTokenByHash(deps.db.kysely, tokenHash);
  if (!candidate) throw invalidRefreshToken();

  const result = await deps.db.kysely.transaction().execute<RotateResult>(async (trx) => {
    const locked = await usersService.lockById(trx, candidate.user_id);
    if (!locked) return { kind: 'invalid' };

    const row = await findRefreshTokenByHashForUpdate(trx, tokenHash);
    if (!row) return { kind: 'invalid' };

    if (row.revoked_at !== null) {
      await revokeFamily(trx, row.family_id, issuedAt);
      return { kind: 'reuse' };
    }

    if (row.expires_at <= issuedAt) {
      await revokeFamily(trx, row.family_id, issuedAt);
      return { kind: 'expired' };
    }

    const user = await usersService.findById(trx, row.user_id);
    if (!user || !user.is_active || user.deleted_at !== null) return { kind: 'invalid' };

    await revokeRefreshToken(trx, row.id, issuedAt);
    const tokens = await issueWith(deps, trx, {
      user,
      meta,
      familyId: row.family_id,
      issuedAt,
    });

    return { kind: 'ok', user, tokens };
  });

  if (result.kind !== 'ok') throw invalidRefreshToken();
  return { user: result.user, tokens: result.tokens };
}

async function authenticateSession(
  deps: SessionDeps,
  rawAccessToken: string | undefined,
): Promise<AuthContext> {
  if (!rawAccessToken) throw unauthorized();

  const payload = await verifyAccessToken(rawAccessToken, deps.config.auth.jwtSecret).catch(() => {
    throw unauthorized();
  });

  const current = deps.now();
  const user = await usersService.findById(deps.db.kysely, payload.sub);
  if (!user || !user.is_active || user.deleted_at !== null) throw unauthorized();

  const active = await hasActiveSession(deps.db.kysely, user.id, payload.sid, current);
  if (!active) throw unauthorized();

  return {
    userId: user.id,
    sessionId: payload.sid,
    user: toUserDto(user, deps.config.storage.publicPath),
  };
}

async function listSessionsForUser(
  deps: SessionDeps,
  userId: string,
  currentSessionId: string,
): Promise<SessionDto[]> {
  const rows = await listActiveSessions(deps.db.kysely, userId, deps.now());

  return rows.map((row) => ({
    id: row.id,
    userAgent: row.user_agent,
    ip: row.ip,
    createdAt: row.created_at.toISOString(),
    lastUsedAt: row.last_used_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    current: row.id === currentSessionId,
  }));
}

async function logoutSession(
  deps: SessionDeps,
  rawRefreshToken: string | undefined,
  rawAccessToken: string | undefined,
): Promise<void> {
  let userId: string | undefined;
  let familyId: string | undefined;

  if (rawRefreshToken) {
    const row = await findRefreshTokenByHash(deps.db.kysely, hashToken(rawRefreshToken));
    if (row) {
      userId = row.user_id;
      familyId = row.family_id;
    }
  }

  if (!familyId && rawAccessToken) {
    const payload = await verifyAccessToken(rawAccessToken, deps.config.auth.jwtSecret).catch(
      () => undefined,
    );
    if (payload) {
      userId = payload.sub;
      familyId = payload.sid;
    }
  }

  if (!userId || !familyId) return;

  await deps.db.kysely.transaction().execute(async (trx) => {
    await usersService.lockById(trx, userId);
    await revokeFamily(trx, familyId, deps.now());
  });
}

async function revokeAllForUser(deps: SessionDeps, userId: string): Promise<void> {
  await deps.db.kysely.transaction().execute(async (trx) => {
    await usersService.lockById(trx, userId);
    await revokeAllSessions(trx, userId, deps.now());
  });
}

export type SessionManager = {
  issue: (user: UserRow, meta: SessionMeta) => Promise<IssuedTokens>;
  rotate: (
    rawRefreshToken: string,
    meta: SessionMeta,
  ) => Promise<{ user: UserRow; tokens: IssuedTokens }>;
  logout: (
    rawRefreshToken: string | undefined,
    rawAccessToken: string | undefined,
  ) => Promise<void>;
  authenticate: (rawAccessToken: string | undefined) => Promise<AuthContext>;
  list: (userId: string, currentSessionId: string) => Promise<SessionDto[]>;
  revokeAll: (userId: string) => Promise<void>;
};

export function createSessionManager({
  db,
  config,
  now = () => new Date(),
}: {
  db: Db;
  config: AppConfig;
  now?: () => Date;
}): SessionManager {
  const deps: SessionDeps = { db, config, now };

  return {
    issue: (user, meta) => issueSession(deps, user, meta),
    rotate: (raw, meta) => rotateSession(deps, raw, meta),
    logout: (rawRefresh, rawAccess) => logoutSession(deps, rawRefresh, rawAccess),
    authenticate: (raw) => authenticateSession(deps, raw),
    list: (userId, currentSessionId) => listSessionsForUser(deps, userId, currentSessionId),
    revokeAll: (userId) => revokeAllForUser(deps, userId),
  };
}
