import { BellRing, BellOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Skeleton } from '../../../shared/ui';
import type { TranslationKey } from '../../../shared/i18n/resources/ru';
import type { PushStatus } from '../model/usePushToggle';
import { usePushToggle } from '../model/usePushToggle';

const STATUS_KEY: Record<PushStatus, TranslationKey> = {
  unsupported: 'notifications.push.unsupported',
  unavailable: 'notifications.push.unavailable',
  configError: 'notifications.push.configError',
  denied: 'notifications.push.denied',
  off: 'notifications.push.off',
  on: 'notifications.push.on',
  busy: 'notifications.push.busy',
};

export function PushToggle({ enabled, userId }: { enabled: boolean; userId: string }) {
  const { t } = useTranslation();
  const { status, errorKey, enable, disable } = usePushToggle(enabled, userId);
  const working = status === 'busy';
  const actionable = status === 'off' || status === 'on' || status === 'busy';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {status === 'on' ? (
            <BellRing className="size-5" aria-hidden="true" />
          ) : (
            <BellOff className="size-5" aria-hidden="true" />
          )}
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-serif text-h3 text-ink">{t('notifications.push.title')}</h2>
          {working ? (
            <Skeleton className="h-4 w-3/4" />
          ) : (
            <p className="text-small text-ink-muted">{t(STATUS_KEY[status])}</p>
          )}
        </div>
      </div>

      {errorKey ? (
        <p role="alert" className="text-small text-danger">
          {t(errorKey)}
        </p>
      ) : null}

      {actionable ? (
        <Button
          variant={status === 'on' ? 'secondary' : 'primary'}
          loading={working}
          disabled={working}
          onClick={() => void (status === 'on' ? disable() : enable())}
          className="w-fit"
        >
          {working
            ? t('notifications.push.busy')
            : status === 'on'
              ? t('notifications.push.disable')
              : t('notifications.push.enable')}
        </Button>
      ) : null}

      {status === 'off' ? (
        <p className="text-caption text-ink-muted">{t('notifications.push.requestHint')}</p>
      ) : null}
    </div>
  );
}
