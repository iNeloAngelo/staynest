import { sql } from 'kysely';
import type { Selectable } from 'kysely';
import type { NotificationType } from '@staynest/shared';
import type { DbExecutor } from '../../platform/db/index';
import type { Json, Notifications, PushSubscriptions } from '../../platform/db/schema.generated';

export type NotificationRow = Selectable<Notifications> & {
  created_at_precise: string;
};

export type PushSubscriptionRow = Selectable<PushSubscriptions>;

const PRECISE_CREATED_AT = sql<string>`to_char(
  notifications.created_at AT TIME ZONE 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
)`;

export function listNotifications(
  executor: DbExecutor,
  userId: string,
  limit: number,
  cursor: { createdAt: string; id: string } | null,
): Promise<NotificationRow[]> {
  let query = executor
    .selectFrom('notifications')
    .selectAll()
    .select(PRECISE_CREATED_AT.as('created_at_precise'))
    .where('user_id', '=', userId);

  if (cursor) {
    query = query.where(
      sql<boolean>`(notifications.created_at, notifications.id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`,
    );
  }

  return query
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit + 1)
    .execute() as Promise<NotificationRow[]>;
}

export async function countUnread(executor: DbExecutor, userId: string): Promise<number> {
  const row = await executor
    .selectFrom('notifications')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('user_id', '=', userId)
    .where('read_at', 'is', null)
    .executeTakeFirstOrThrow();

  return Number(row.count);
}

export function insertNotification(
  executor: DbExecutor,
  input: {
    userId: string;
    type: NotificationType;
    payload: Record<string, unknown>;
    dedupeKey?: string;
  },
): Promise<NotificationRow | undefined> {
  let query = executor.insertInto('notifications').values({
    user_id: input.userId,
    type: input.type,
    payload: input.payload as unknown as Json,
    ...(input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}),
  });

  if (input.dedupeKey) {
    query = query.onConflict((oc) =>
      oc.columns(['user_id', 'dedupe_key']).where('dedupe_key', 'is not', null).doNothing(),
    );
  }

  return query
    .returningAll()
    .returning(PRECISE_CREATED_AT.as('created_at_precise'))
    .executeTakeFirst() as Promise<NotificationRow | undefined>;
}

export async function markRead(
  executor: DbExecutor,
  userId: string,
  readAt: Date,
  ids?: string[],
): Promise<number> {
  let query = executor
    .updateTable('notifications')
    .set({ read_at: readAt })
    .where('user_id', '=', userId)
    .where('read_at', 'is', null);

  if (ids && ids.length > 0) query = query.where('id', 'in', ids);

  const result = await query.executeTakeFirst();
  return Number(result.numUpdatedRows);
}

export function listPushSubscriptions(
  executor: DbExecutor,
  userId: string,
): Promise<PushSubscriptionRow[]> {
  return executor
    .selectFrom('push_subscriptions')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('created_at', 'asc')
    .execute();
}

/** Один браузерный endpoint принадлежит одному пользователю: вход сменил владельца. */
export function upsertPushSubscription(
  executor: DbExecutor,
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string; userAgent: string | null },
): Promise<PushSubscriptionRow> {
  return executor
    .insertInto('push_subscriptions')
    .values({
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent,
    })
    .onConflict((oc) =>
      oc.column('endpoint').doUpdateSet({
        user_id: userId,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent,
        last_used_at: null,
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deletePushSubscription(
  executor: DbExecutor,
  userId: string,
  endpoint: string,
): Promise<void> {
  await executor
    .deleteFrom('push_subscriptions')
    .where('user_id', '=', userId)
    .where('endpoint', '=', endpoint)
    .executeTakeFirst();
}

export async function deletePushSubscriptionById(executor: DbExecutor, id: string): Promise<void> {
  await executor.deleteFrom('push_subscriptions').where('id', '=', id).executeTakeFirst();
}

export async function touchPushSubscription(
  executor: DbExecutor,
  id: string,
  at: Date,
): Promise<void> {
  await executor
    .updateTable('push_subscriptions')
    .set({ last_used_at: at })
    .where('id', '=', id)
    .executeTakeFirst();
}
