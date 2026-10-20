import type { DashboardResponse } from '@staynest/shared';
import { CalendarCheck2, Inbox, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../../shared/i18n';
import { formatShortDate, formatMonth } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/format';

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2 text-ink-muted">
        {icon}
        <h2 className="font-sans text-small font-medium">{label}</h2>
      </div>
      <p className="font-serif text-h2 text-ink tabular-nums">{value}</p>
      {hint ? <p className="text-caption text-ink-muted">{hint}</p> : null}
    </article>
  );
}

function OccupancyCard({ occupancy }: { occupancy: DashboardResponse['occupancy'] }) {
  const { t } = useTranslation();

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <h2 className="font-sans text-small font-medium text-ink-muted">
        {t('hostDashboard.occupancy')}
      </h2>
      <p className="font-serif text-h2 text-ink tabular-nums">{occupancy.percent}%</p>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={occupancy.percent}
        aria-label={t('hostDashboard.occupancy')}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-panel"
          style={{ transform: `scaleX(${occupancy.percent / 100})` }}
        />
      </div>

      <p className="text-caption text-ink-muted">
        {t('hostDashboard.occupancyValue', {
          occupied: occupancy.occupiedNights,
          total: occupancy.totalNights,
        })}
        {' · '}
        {t('hostDashboard.occupancyHint')}
      </p>
    </article>
  );
}

export function DashboardKpis({ data }: { data: DashboardResponse }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const next = data.upcomingCheckIns[0];
  const current = data.revenue.months.at(-1);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={<Inbox className="size-5" aria-hidden="true" strokeWidth={1.75} />}
        label={t('hostDashboard.pending')}
        value={String(data.pendingRequests)}
        hint={
          data.pendingRequests > 0
            ? t('hostDashboard.pendingHint')
            : t('hostDashboard.pendingEmpty')
        }
      />

      <KpiCard
        icon={<CalendarCheck2 className="size-5" aria-hidden="true" strokeWidth={1.75} />}
        label={t('hostDashboard.nextCheckIn')}
        value={next ? formatShortDate(next.checkIn, locale) : '—'}
        hint={next ? next.listingTitle : t('hostDashboard.noCheckIn')}
      />

      <OccupancyCard occupancy={data.occupancy} />

      <KpiCard
        icon={<Wallet className="size-5" aria-hidden="true" strokeWidth={1.75} />}
        label={t('hostDashboard.revenue')}
        value={current ? formatMoney(current.totalMinor, locale, data.revenue.currency) : '—'}
        hint={current ? formatMonth(current.month, locale) : undefined}
      />
    </div>
  );
}

export function DashboardRequestsLink({ count }: { count: number }) {
  const { t } = useTranslation();

  if (count === 0) return null;

  return (
    <Link
      to="/host/requests"
      className="w-fit text-small font-semibold text-primary underline-offset-4 hover:underline"
    >
      {t('hostDashboard.viewRequests', { count })}
    </Link>
  );
}
