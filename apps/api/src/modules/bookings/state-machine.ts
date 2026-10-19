import type { BookingStatus } from '@staynest/shared';

export type BookingAction = 'confirm' | 'decline' | 'cancel';
export type BookingActorRole = 'guest' | 'host';

/**
 * Таблица разрешённых переходов. Действие — это команда пользователя,
 * целевой статус зависит от роли гостя или хозяина.
 *
 * Подтверждение и отклонение — только хозяин и только из `pending`.
 * Отмена: гость отменяет pending/confirmed, хозяин — только confirmed
 * (отказ от pending оформляется как decline).
 */
const TRANSITIONS: Record<
  BookingAction,
  Partial<Record<BookingStatus, Partial<Record<BookingActorRole, BookingStatus>>>>
> = {
  confirm: {
    pending: { host: 'confirmed' },
  },
  decline: {
    pending: { host: 'declined' },
  },
  cancel: {
    pending: { guest: 'cancelled_by_guest' },
    confirmed: {
      guest: 'cancelled_by_guest',
      host: 'cancelled_by_host',
    },
  },
};

export function resolveTransition(
  action: BookingAction,
  from: BookingStatus,
  role: BookingActorRole,
): BookingStatus | null {
  return TRANSITIONS[action][from]?.[role] ?? null;
}

/** Причина обязательна, когда хозяин отменяет уже подтверждённую бронь. */
export function transitionRequiresReason(target: BookingStatus): boolean {
  return target === 'cancelled_by_host';
}
