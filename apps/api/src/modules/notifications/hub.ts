import type { NotificationDto } from '@staynest/shared';

export type NotificationStreamClient = {
  send: (notification: NotificationDto) => void;
  close: () => void;
};

export type NotificationHub = {
  /** Возвращает false, если у пользователя уже слишком много открытых потоков. */
  subscribe(userId: string, client: NotificationStreamClient): boolean;
  unsubscribe(userId: string, client: NotificationStreamClient): void;
  publish(userId: string, notification: NotificationDto): void;
  count(userId: string): number;
  closeAll(): void;
};

export const MAX_STREAMS_PER_USER = 5;

/**
 * SSE-подписки живут в памяти процесса: один инстанс API для MVP.
 * При нескольких инстансах понадобится общий broker (Postgres LISTEN/NOTIFY).
 */
export function createNotificationHub(maxPerUser = MAX_STREAMS_PER_USER): NotificationHub {
  const streams = new Map<string, Set<NotificationStreamClient>>();

  return {
    subscribe(userId, client) {
      const existing = streams.get(userId) ?? new Set<NotificationStreamClient>();
      if (existing.size >= maxPerUser) return false;

      existing.add(client);
      streams.set(userId, existing);
      return true;
    },

    unsubscribe(userId, client) {
      const existing = streams.get(userId);
      if (!existing) return;

      existing.delete(client);
      if (existing.size === 0) streams.delete(userId);
    },

    publish(userId, notification) {
      const existing = streams.get(userId);
      if (!existing) return;

      for (const client of existing) {
        try {
          client.send(notification);
        } catch {
          // Оборванный поток не должен мешать остальным подписчикам.
          existing.delete(client);
        }
      }
    },

    count(userId) {
      return streams.get(userId)?.size ?? 0;
    },

    closeAll() {
      for (const clients of streams.values()) {
        for (const client of [...clients]) {
          try {
            client.close();
          } catch {
            // Сокет мог уже закрыться сам.
          }
        }
      }
      streams.clear();
    },
  };
}
