import type { NotificationDto } from '@staynest/shared';
import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, IconButton, Modal } from '../../../shared/ui';
import { useMarkNotificationsRead, useNotifications } from '../api/hooks';
import { notificationHref } from '../model/labels';
import { useNotificationStream } from '../model/useNotificationStream';
import { NotificationPanel } from './NotificationPanel';

type BellDialogProps = {
  open: boolean;
  onClose: () => void;
  notifications: NotificationDto[];
  isLoading: boolean;
  isError: boolean;
  unread: number;
  marking: boolean;
  onRetry: () => void;
  onMarkAll: () => void;
  onOpen: (notification: NotificationDto) => void;
};

function BellDialog({
  open,
  onClose,
  notifications,
  isLoading,
  isError,
  unread,
  marking,
  onRetry,
  onMarkAll,
  onOpen,
}: BellDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('notifications.title')}
      footer={
        unread > 0 ? (
          <Button
            variant="secondary"
            loading={marking}
            leftIcon={<CheckCheck className="size-4" aria-hidden="true" />}
            onClick={onMarkAll}
          >
            {t('notifications.markAll')}
          </Button>
        ) : undefined
      }
    >
      <NotificationPanel
        notifications={notifications}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        onOpen={onOpen}
      />
    </Modal>
  );
}

export function NotificationBell({ enabled, userId }: { enabled: boolean; userId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications(enabled, userId);
  const markRead = useMarkNotificationsRead(userId);

  useNotificationStream(enabled, userId);

  const items = notifications.data?.notifications ?? [];
  const unread = notifications.data?.unreadCount ?? 0;
  const label =
    unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell');

  function openNotification(notification: NotificationDto): void {
    if (notification.readAt === null) markRead.mutate({ ids: [notification.id] });
    setOpen(false);
    navigate(notificationHref(notification));
  }

  return (
    <>
      <IconButton
        label={label}
        onClick={() => setOpen(true)}
        className="relative"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption font-semibold text-on-primary"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </IconButton>

      <BellDialog
        open={open}
        onClose={() => setOpen(false)}
        notifications={items}
        isLoading={notifications.isPending}
        isError={notifications.isError}
        unread={unread}
        marking={markRead.isPending}
        onRetry={() => void notifications.refetch()}
        onMarkAll={() => markRead.mutate({})}
        onOpen={openNotification}
      />
    </>
  );
}
