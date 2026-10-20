import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, buttonClassName } from '../../shared/ui';

export function OfflinePage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-lg border border-border bg-surface px-6 py-10 text-center shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-primary">
        <WifiOff className="size-7" aria-hidden="true" />
      </span>

      <h1 className="text-h1 text-ink">{t('pwa.offline.title')}</h1>
      <p className="max-w-prose text-body text-ink-muted">{t('pwa.offline.body')}</p>

      <div className="flex flex-wrap justify-center gap-3 pt-1">
        <Button onClick={() => window.location.reload()}>{t('pwa.offline.retry')}</Button>
        <Link to="/" className={buttonClassName({ variant: 'secondary' })}>
          {t('pwa.offline.home')}
        </Link>
      </div>
    </div>
  );
}
