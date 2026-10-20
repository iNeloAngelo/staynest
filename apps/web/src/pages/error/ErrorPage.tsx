import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, buttonClassName } from '../../shared/ui';

export function ErrorPage({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-lg border border-border bg-surface px-6 py-10 text-center shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger/12 text-danger">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </span>

      <h1 ref={headingRef} tabIndex={-1} className="text-h1 text-ink">
        {t('error.title')}
      </h1>
      <p className="max-w-prose text-body text-ink-muted">{t('error.body')}</p>

      <div className="flex flex-wrap justify-center gap-3 pt-1">
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            {t('error.retry')}
          </Button>
        ) : (
          <Button onClick={() => window.location.reload()}>{t('error.retry')}</Button>
        )}

        <Link to="/" className={buttonClassName({ variant: 'secondary' })}>
          {t('error.home')}
        </Link>
      </div>
    </div>
  );
}
