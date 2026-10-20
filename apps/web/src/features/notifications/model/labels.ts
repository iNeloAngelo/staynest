import type { NotificationDto, NotificationPayload, NotificationType } from '@staynest/shared';
import type { TFunction } from 'i18next';
import { Ban, Bell, CalendarCheck, CalendarX, CheckCircle2, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from '../../../shared/i18n/resources/ru';
import { formatShortDate } from '../../../shared/lib/dates';

export const NOTIFICATION_META: Record<
  NotificationType,
  { titleKey: TranslationKey; icon: LucideIcon; tone: 'info' | 'success' | 'danger' | 'muted' }
> = {
  booking_requested: { titleKey: 'notifications.item.requestedTitle', icon: Bell, tone: 'info' },
  booking_confirmed: {
    titleKey: 'notifications.item.confirmedTitle',
    icon: CalendarCheck,
    tone: 'success',
  },
  booking_declined: {
    titleKey: 'notifications.item.declinedTitle',
    icon: CalendarX,
    tone: 'danger',
  },
  booking_cancelled: {
    titleKey: 'notifications.item.cancelledTitle',
    icon: Ban,
    tone: 'danger',
  },
  booking_expired: {
    titleKey: 'notifications.item.expiredTitle',
    icon: Clock,
    tone: 'muted',
  },
  booking_deposit_expired: {
    titleKey: 'notifications.item.depositExpiredTitle',
    icon: Clock,
    tone: 'danger',
  },
  booking_expiring_soon: {
    titleKey: 'notifications.item.expiringSoonTitle',
    icon: Clock,
    tone: 'info',
  },
  booking_completed: {
    titleKey: 'notifications.item.completedTitle',
    icon: CheckCircle2,
    tone: 'success',
  },
};

export function notificationDescription(
  notification: NotificationDto,
  t: TFunction,
  language: string,
): string {
  const params = notificationDescriptionParams(notification.payload, language);

  switch (notification.type) {
    case 'booking_requested':
      return t('notifications.item.requested', { ...params, defaultValue: '' });
    case 'booking_confirmed':
      return t('notifications.item.confirmed', { ...params, defaultValue: '' });
    case 'booking_declined':
      return t('notifications.item.declined', { ...params, defaultValue: '' });
    case 'booking_cancelled':
      return notification.payload.actorRole === 'guest'
        ? t('notifications.item.cancelledByGuest', { ...params, defaultValue: '' })
        : t('notifications.item.cancelledByHost', { ...params, defaultValue: '' });
    case 'booking_expired':
      return t('notifications.item.expired', { ...params, defaultValue: '' });
    case 'booking_deposit_expired':
      return t('notifications.item.depositExpired', { ...params, defaultValue: '' });
    case 'booking_expiring_soon':
      return t('notifications.item.expiringSoon', { ...params, defaultValue: '' });
    case 'booking_completed':
      return t('notifications.item.completed', { ...params, defaultValue: '' });
  }
}

function notificationDescriptionParams(
  payload: NotificationPayload,
  language: string,
): Record<string, string> {
  return {
    guest: payload.guestName,
    title: payload.listingTitle,
    dates: `${formatShortDate(payload.checkIn, language)} — ${formatShortDate(
      payload.checkOut,
      language,
    )}`,
  };
}

export function notificationHref(notification: NotificationDto): string {
  return `/bookings/${notification.payload.bookingId}`;
}
