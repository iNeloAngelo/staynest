import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import type { Selectable } from 'kysely';
import type { DbExecutor } from '../../platform/db/index';
import type { IdempotencyKeys, Json } from '../../platform/db/schema.generated';

export const BOOKING_ENDPOINT = 'POST /bookings';

export type IdempotencyRow = Selectable<IdempotencyKeys>;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value !== 'object' || value === null) return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

/** Одинаковое тело в разном порядке ключей даёт одинаковый хэш. */
export function bookingRequestHash(input: unknown): string {
  return createHash('sha256')
    .update(BOOKING_ENDPOINT)
    .update('\n')
    .update(JSON.stringify(stableValue(input)))
    .digest('hex');
}

/**
 * Сериализует конкурентные запросы с одним Idempotency-Key: advisory lock
 * живёт до конца транзакции. Без него два одинаковых запроса оба прошли бы
 * проверку «ключа ещё нет» и создали две брони.
 */
export async function lockIdempotencyKey(
  executor: DbExecutor,
  userId: string,
  key: string,
): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${key}`}, 0))`.execute(
    executor,
  );
}

export function findIdempotency(
  executor: DbExecutor,
  userId: string,
  key: string,
): Promise<IdempotencyRow | undefined> {
  return executor
    .selectFrom('idempotency_keys')
    .selectAll()
    .where('user_id', '=', userId)
    .where('key', '=', key)
    .executeTakeFirst();
}

export async function saveIdempotentResponse(
  executor: DbExecutor,
  input: {
    userId: string;
    key: string;
    requestHash: string;
    status: number;
    body: unknown;
  },
): Promise<void> {
  await executor
    .insertInto('idempotency_keys')
    .values({
      user_id: input.userId,
      key: input.key,
      endpoint: BOOKING_ENDPOINT,
      request_hash: input.requestHash,
      response_status: input.status,
      response_body: input.body as unknown as Json,
    })
    .execute();
}

export async function deleteIdempotencyOlderThan(
  executor: DbExecutor,
  cutoff: Date,
): Promise<number> {
  const result = await executor
    .deleteFrom('idempotency_keys')
    .where('created_at', '<', cutoff)
    .executeTakeFirst();

  return Number(result.numDeletedRows ?? 0n);
}
