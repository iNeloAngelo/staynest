import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchHealth } from '../../../shared/api';
import { Skeleton } from '../../../shared/ui';

export function DiagnosticsSection() {
  const { t } = useTranslation();
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: false });

  return (
    <section aria-labelledby="dev-diagnostics" className="flex flex-col gap-4">
      <h2 id="dev-diagnostics" className="text-h2 text-ink">
        {t('dev.section.diagnostics')}
      </h2>

      <div
        aria-live="polite"
        className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6"
      >
        <h3 className="text-small font-semibold text-ink">{t('health.title')}</h3>

        {health.isPending ? <Skeleton className="h-4 w-2/3" /> : null}

        {health.isError ? (
          <p className="text-small text-danger">{t('health.unavailable')}</p>
        ) : null}

        {health.data ? (
          <p className="text-small text-ink">
            {t('health.status', {
              status: health.data.status,
              db: health.data.db,
              version: health.data.version,
            })}
          </p>
        ) : null}
      </div>
    </section>
  );
}
