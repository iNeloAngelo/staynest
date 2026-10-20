import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useOnline } from '../../../shared/lib/useOnline';
import { textLink } from '../../../shared/ui';

export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-border bg-surface-2 px-4 py-2 text-center text-small text-ink"
    >
      <WifiOff className="mr-2 inline size-4 align-[-2px]" aria-hidden="true" />
      {t('pwa.offlineBanner')}{' '}
      <Link to="/offline" className={textLink}>
        {t('pwa.offline.details')}
      </Link>
    </div>
  );
}
