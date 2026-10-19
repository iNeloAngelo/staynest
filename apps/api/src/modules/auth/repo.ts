import { sql } from 'kysely';
import type { Selectable } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';
import type { AuthTokens, RefreshTokens } from '../../platform/db/schema.generated';

export type RefreshTokenRow = Selectable<RefreshTokens>;
export type AuthTokenRow = Selectable<AuthTokens>;

export type NewRefreshToken = {
  userId: string;
  tokenHash: string;
  familyId: string;
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
};

export type SessionRow = {
  id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: Date;
  last_used_at: Date;
  expires_at: Date;
};

export async function insertRefreshToken(
  executor: DbExecutor,
  input: NewRefreshToken,
): Promise<void> {
  await executor
    .insertInto('refresh_tokens')
    .values({
      user_id: input.userId,
      token_hash: input.tokenHash,
      family_id: input.familyId,
      user_agent: input.userAgent,
      ip: input.ip,
      expires_at: input.expiresAt,
    })
    .execute();
}

export function findRefreshTokenByHash(
  executor: DbExecutor,
  tokenHash: string,
): Promise<RefreshTokenRow | undefined> {
  return executor
    .selectFrom('refresh_tokens')
    .selectAll()
    .where('token_hash', '=', tokenHash)
    .executeTakeFirst();
}

export function findRefreshTokenByHashForUpdate(
  executor: DbExecutor,
  tokenHash: string,
): Promise<RefreshTokenRow | undefined> {
  return executor
    .selectFrom('refresh_tokens')
    .selectAll()
    .where('token_hash', '=', tokenHash)
    .forUpdate()
    .executeTakeFirst();
}

export async function revokeRefreshToken(
  executor: DbExecutor,
  id: string,
  at: Date,
): Promise<void> {
  await executor
    .updateTable('refresh_tokens')
    .set({ revoked_at: at })
    .where('id', '=', id)
    .where('revoked_at', 'is', null)
    .execute();
}

export async function revokeFamily(
  executor: DbExecutor,
  familyId: string,
  at: Date,
): Promise<void> {
  await executor
    .updateTable('refresh_tokens')
    .set({ revoked_at: at })
    .where('family_id', '=', familyId)
    .where('revoked_at', 'is', null)
    .execute();
}

export async function revokeAllSessions(
  executor: DbExecutor,
  userId: string,
  at: Date,
): Promise<void> {
  await executor
    .updateTable('refresh_tokens')
    .set({ revoked_at: at })
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .execute();
}

export async function hasActiveSession(
  executor: DbExecutor,
  userId: string,
  familyId: string,
  now: Date,
): Promise<boolean> {
  const row = await executor
    .selectFrom('refresh_tokens')
    .select('id')
    .where('user_id', '=', userId)
    .where('family_id', '=', familyId)
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', now)
    .executeTakeFirst();

  return row !== undefined;
}

export async function listActiveSessions(
  executor: DbExecutor,
  userId: string,
  now: Date,
): Promise<SessionRow[]> {
  const result = await sql<SessionRow>`
    SELECT family_id AS id,
           (array_agg(user_agent ORDER BY created_at DESC))[1] AS user_agent,
           (array_agg(ip ORDER BY created_at DESC))[1] AS ip,
           min(created_at) AS created_at,
           max(created_at) AS last_used_at,
           max(expires_at) AS expires_at
    FROM refresh_tokens
    WHERE user_id = ${userId}
      AND revoked_at IS NULL
      AND expires_at > ${now}
    GROUP BY family_id
    ORDER BY max(created_at) DESC
  `.execute(executor);

  return result.rows;
}

export type NewAuthToken = {
  userId: string;
  kind: 'verify_email' | 'reset_password';
  tokenHash: string;
  expiresAt: Date;
};

export async function insertAuthToken(executor: DbExecutor, input: NewAuthToken): Promise<void> {
  await executor
    .insertInto('auth_tokens')
    .values({
      user_id: input.userId,
      kind: input.kind,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
    })
    .execute();
}

export function findAuthTokenByHash(
  executor: DbExecutor,
  tokenHash: string,
  kind: 'verify_email' | 'reset_password',
): Promise<AuthTokenRow | undefined> {
  return executor
    .selectFrom('auth_tokens')
    .selectAll()
    .where('token_hash', '=', tokenHash)
    .where('kind', '=', kind)
    .executeTakeFirst();
}

export function findAuthTokenByHashForUpdate(
  executor: DbExecutor,
  tokenHash: string,
  kind: 'verify_email' | 'reset_password',
): Promise<AuthTokenRow | undefined> {
  return executor
    .selectFrom('auth_tokens')
    .selectAll()
    .where('token_hash', '=', tokenHash)
    .where('kind', '=', kind)
    .forUpdate()
    .executeTakeFirst();
}

export async function markAuthTokenUsed(executor: DbExecutor, id: string, at: Date): Promise<void> {
  await executor
    .updateTable('auth_tokens')
    .set({ used_at: at })
    .where('id', '=', id)
    .where('used_at', 'is', null)
    .execute();
}

export async function invalidateAuthTokens(
  executor: DbExecutor,
  userId: string,
  kind: 'verify_email' | 'reset_password',
  at: Date,
): Promise<void> {
  await executor
    .updateTable('auth_tokens')
    .set({ used_at: at })
    .where('user_id', '=', userId)
    .where('kind', '=', kind)
    .where('used_at', 'is', null)
    .execute();
}
