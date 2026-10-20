import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui';
import { useServiceWorkerUpdate } from '../model/useServiceWorkerUpdate';

export function UpdateBanner() {
  const { t } = useTranslation();
  const { needRefresh, applyUpdate, dismiss } = useServiceWorkerUpdate();

  if (!needRefresh) return null;

  return (
    <div role="status" aria-live="polite" className="border-b border-border bg-surface px-4 py-3">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-small text-ink">{t('pwa.update.title')}</p>

        <Button
          size="md"
          leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
          onClick={applyUpdate}
        >
          {t('pwa.update.action')}
        </Button>

        <Button variant="ghost" onClick={dismiss}>
          {t('pwa.update.later')}
        </Button>
      </div>
    </div>
  );
}
