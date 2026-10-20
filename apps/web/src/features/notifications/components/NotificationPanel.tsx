import type { NotificationDto } from '@staynest/shared';
import { BellOff, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../../shared/lib/useOnline';
import { Button, EmptyState, Skeleton } from '../../../shared/ui';
import { NotificationItem } from './NotificationItem';

function LoadingPanel() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label={t('common.loading')}>
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-start gap-3 px-3 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const online = useOnline();

  if (!online) {
    return (
      <EmptyState
        icon={<WifiOff className="size-6" aria-hidden="true" />}
        title={t('notifications.offlineTitle')}
        description={t('notifications.offlineBody')}
        className="border-0 bg-transparent px-0"
      />
    );
  }

  return (
    <EmptyState
      icon={<WifiOff className="size-6" aria-hidden="true" />}
      title={t('notifications.errorTitle')}
      description={t('notifications.errorBody')}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
      className="border-0 bg-transparent px-0"
    />
  );
}

function EmptyPanel() {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={<BellOff className="size-6" aria-hidden="true" />}
      title={t('notifications.emptyTitle')}
      description={t('notifications.emptyBody')}
      className="border-0 bg-transparent px-0"
    />
  );
}

export function NotificationPanel({
  notifications,
  isLoading,
  isError,
  onRetry,
  onOpen,
}: {
  notifications: NotificationDto[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpen: (notification: NotificationDto) => void;
}) {
  if (isError) return <ErrorPanel onRetry={onRetry} />;
  if (isLoading) return <LoadingPanel />;
  if (notifications.length === 0) return <EmptyPanel />;

  return (
    <ul className="flex flex-col gap-1">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onOpen={onOpen} />
      ))}
    </ul>
  );
}
