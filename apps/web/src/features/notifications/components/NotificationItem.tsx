import type { NotificationDto } from '@staynest/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../shared/lib/cn';
import { formatDateTime } from '../../../shared/lib/dates';
import { NOTIFICATION_META, notificationDescription } from '../model/labels';

const TONE_STYLES = {
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  muted: 'bg-surface-2 text-ink-muted',
} as const;

export function NotificationItem({
  notification,
  onOpen,
}: {
  notification: NotificationDto;
  onOpen: (notification: NotificationDto) => void;
}) {
  const { t: translate, i18n } = useTranslation();
  const t: TFunction = translate;
  const meta = NOTIFICATION_META[notification.type];
  const Icon = meta.icon;
  const unread = notification.readAt === null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className={cn(
          'flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors duration-micro hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          unread && 'bg-primary/5',
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
            TONE_STYLES[meta.tone],
          )}
        >
          <Icon className="size-5" aria-hidden="true" strokeWidth={1.75} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="text-small font-semibold text-ink">{t(meta.titleKey)}</span>
            {unread ? (
              <>
                <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="sr-only">{t('notifications.unreadMark')}</span>
              </>
            ) : null}
          </span>

          <span className="text-small text-ink-muted">
            {notificationDescription(notification, t, i18n.language)}
          </span>

          <span className="text-caption text-ink-muted">
            {formatDateTime(notification.createdAt, i18n.language)}
          </span>
        </span>
      </button>
    </li>
  );
}
