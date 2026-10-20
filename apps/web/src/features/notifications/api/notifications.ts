import type {
  MarkNotificationsReadInput,
  MarkNotificationsReadResponse,
  NotificationListQuery,
  NotificationsResponse,
  PushConfigResponse,
  PushSubscriptionInput,
  PushSubscriptionResponse,
} from '@staynest/shared';
import { api } from '../../../shared/api';

const BASE = '/me/notifications';

function listQuery(query: NotificationListQuery): string {
  const params = new URLSearchParams({ limit: String(query.limit) });
  if (query.cursor) params.set('cursor', query.cursor);
  return params.toString();
}

export function fetchNotifications(query: NotificationListQuery): Promise<NotificationsResponse> {
  return api.get<NotificationsResponse>(`${BASE}?${listQuery(query)}`);
}

export function markNotificationsRead(
  input: MarkNotificationsReadInput,
): Promise<MarkNotificationsReadResponse> {
  return api.post<MarkNotificationsReadResponse>(`${BASE}/read`, input);
}

export function fetchPushConfig(): Promise<PushConfigResponse> {
  return api.get<PushConfigResponse>('/me/push/config');
}

export function subscribeToPush(input: PushSubscriptionInput): Promise<PushSubscriptionResponse> {
  return api.post<PushSubscriptionResponse>('/me/push-subscriptions', input);
}

export function unsubscribeFromPush(endpoint: string): Promise<void> {
  return api.delete<void>('/me/push-subscriptions', { endpoint });
}
