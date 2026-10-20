import type { NotificationDto, NotificationPayload, NotificationType } from '@staynest/shared';
import type { NotificationRow } from './repo';

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type as NotificationType,
    payload: row.payload as unknown as NotificationPayload,
    readAt: row.read_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
