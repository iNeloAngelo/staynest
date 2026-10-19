import { Link2Off } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { textLink } from '../../../shared/ui';

export function InvalidLink({ action }: { action?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-start gap-4">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger/12 text-danger">
        <Link2Off className="size-6" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-h2 text-ink">{t('auth.link.invalidTitle')}</h2>
        <p className="text-body text-ink-muted">{t('auth.link.invalidBody')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/login" className={textLink}>
          {t('auth.link.toLogin')}
        </Link>
        {action}
      </div>
    </div>
  );
}
