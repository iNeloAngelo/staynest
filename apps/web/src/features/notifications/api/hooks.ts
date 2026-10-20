import type {
  MarkNotificationsReadInput,
  MarkNotificationsReadResponse,
  NotificationDto,
  NotificationsResponse,
  PushConfigResponse,
} from '@staynest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  fetchPushConfig,
  markNotificationsRead,
  subscribeToPush,
} from './notifications';

const NOTIFICATION_LIMIT = 20;
const REFETCH_INTERVAL_MS = 60_000;

const notificationKeys = {
  all: ['notifications'] as const,
  list: (userId: string) => ['notifications', 'list', userId] as const,
  pushConfig: ['notifications', 'push-config'] as const,
};

export function useNotifications(enabled: boolean, userId: string | undefined) {
  return useQuery<NotificationsResponse>({
    queryKey: notificationKeys.list(userId ?? ''),
    queryFn: () => fetchNotifications({ limit: NOTIFICATION_LIMIT }),
    enabled: enabled && Boolean(userId),
    staleTime: 15_000,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationsRead(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MarkNotificationsReadInput) => markNotificationsRead(input),
    onSuccess: (result: MarkNotificationsReadResponse, input) => {
      queryClient.setQueryData<NotificationsResponse>(
        notificationKeys.list(userId ?? ''),
        (current) => {
          if (!current) return current;

          const readAt = new Date().toISOString();
          const ids = input.ids ? new Set(input.ids) : null;
          return {
            ...current,
            unreadCount: result.unreadCount,
            notifications: current.notifications.map((item) =>
              !item.readAt && (ids === null || ids.has(item.id)) ? { ...item, readAt } : item,
            ),
          };
        },
      );
    },
  });
}

export function usePushConfig(enabled: boolean) {
  return useQuery<PushConfigResponse>({
    queryKey: notificationKeys.pushConfig,
    queryFn: fetchPushConfig,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function usePushSubscriptionMutation() {
  return useMutation({
    mutationFn: subscribeToPush,
  });
}

/** Обновляет кэш уведомлений из SSE без перезагрузки страницы. */
export function applyIncomingNotification(
  queryClient: ReturnType<typeof useQueryClient>,
  notification: NotificationDto,
  userId: string,
): void {
  queryClient.setQueryData<NotificationsResponse>(notificationKeys.list(userId), (current) => {
    if (!current) return current;
    if (current.notifications.some((item) => item.id === notification.id)) return current;

    return {
      ...current,
      unreadCount: current.unreadCount + 1,
      notifications: [notification, ...current.notifications].slice(0, 50),
    };
  });
}
