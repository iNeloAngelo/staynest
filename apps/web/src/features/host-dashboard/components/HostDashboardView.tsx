import { LayoutDashboard, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../../shared/lib/useOnline';
import { Button, EmptyState, Skeleton } from '../../../shared/ui';
import { useDashboard } from '../api/hooks';
import { DashboardKpis, DashboardRequestsLink } from './DashboardKpis';
import { RevenueChart } from './RevenueChart';
import { UpcomingCheckIns } from './UpcomingCheckIns';

function DashboardSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('common.loading')}
      className="flex flex-col gap-4"
    >
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

export function HostDashboardView() {
  const { t } = useTranslation();
  const online = useOnline();
  const query = useDashboard();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-h1 text-ink">{t('pages.hostDashboard.title')}</h1>
        <p className="mt-1 text-small text-ink-muted">{t('hostDashboard.subtitle')}</p>
      </header>

      {query.isPending ? <DashboardSkeleton /> : null}

      {query.isError && !query.data ? (
        <EmptyState
          icon={<WifiOff className="size-6" aria-hidden="true" />}
          title={online ? t('hostDashboard.loadErrorTitle') : t('hostDashboard.offlineTitle')}
          description={online ? t('hostDashboard.loadErrorBody') : t('hostDashboard.offlineBody')}
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : null}

      {query.data ? (
        <>
          {!online ? (
            <p
              role="status"
              className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-small text-ink-muted"
            >
              <WifiOff className="size-4" aria-hidden="true" />
              {t('hostDashboard.offline')}
            </p>
          ) : null}

          <DashboardKpis data={query.data} />
          <DashboardRequestsLink count={query.data.pendingRequests} />

          <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 font-serif text-h3 text-ink">
                <LayoutDashboard className="size-5 text-ink-muted" aria-hidden="true" />
                {t('hostDashboard.revenueTitle')}
              </h2>
              <p className="text-caption text-ink-muted">{t('hostDashboard.revenueHint')}</p>
            </div>

            <RevenueChart
              months={query.data.revenue.months}
              currency={query.data.revenue.currency}
            />
          </section>

          <UpcomingCheckIns checkIns={query.data.upcomingCheckIns} />
        </>
      ) : null}
    </div>
  );
}
