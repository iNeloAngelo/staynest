import { Ban, CheckCircle2, Clock, Flag, Search, TimerOff, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, EmptyState, Skeleton, SkeletonText } from '../../../shared/ui';

export function DataSection() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="dev-data" className="flex flex-col gap-4">
      <h2 id="dev-data" className="text-h2 text-ink">
        {t('dev.section.data')}
      </h2>

      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-small font-semibold text-ink">{t('dev.data.badges')}</h3>
          <div className="flex flex-wrap gap-2">
            <Badge tone="warning" icon={<Clock className="size-3.5" aria-hidden="true" />}>
              {t('dev.data.pending')}
            </Badge>
            <Badge tone="success" icon={<CheckCircle2 className="size-3.5" aria-hidden="true" />}>
              {t('dev.data.confirmed')}
            </Badge>
            <Badge tone="danger" icon={<XCircle className="size-3.5" aria-hidden="true" />}>
              {t('dev.data.declined')}
            </Badge>
            <Badge tone="neutral" icon={<Ban className="size-3.5" aria-hidden="true" />}>
              {t('dev.data.cancelled')}
            </Badge>
            <Badge tone="neutral" icon={<TimerOff className="size-3.5" aria-hidden="true" />}>
              {t('dev.data.expired')}
            </Badge>
            <Badge tone="info" icon={<Flag className="size-3.5" aria-hidden="true" />}>
              {t('dev.data.completed')}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-small font-semibold text-ink">{t('dev.data.skeleton')}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Skeleton className="aspect-[4/3] w-full rounded-lg" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <SkeletonText lines={5} />
          </div>
        </div>

        <EmptyState
          icon={<Search className="size-6" aria-hidden="true" />}
          title={t('dev.data.emptyTitle')}
          description={t('dev.data.emptyBody')}
          action={<Button variant="secondary">{t('dev.data.emptyAction')}</Button>}
        />
      </div>
    </section>
  );
}
