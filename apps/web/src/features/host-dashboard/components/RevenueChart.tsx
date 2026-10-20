import type { DashboardRevenueMonth } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../../shared/i18n';
import { formatMonth } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/format';

type RevenueChartProps = {
  months: DashboardRevenueMonth[];
  currency: string;
};

type BarProps = {
  month: DashboardRevenueMonth;
  x: number;
  width: number;
  height: number;
  currency: string;
};

const WIDTH = 360;
const HEIGHT = 160;
const TOP = 12;
const BOTTOM = 16;
const SIDE = 8;

function Bar({ month, x, width, height, currency }: BarProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  return (
    <rect
      x={x}
      y={HEIGHT - BOTTOM - height}
      width={width}
      height={height}
      rx={4}
      className={month.totalMinor === 0 ? 'fill-surface-2' : 'fill-primary'}
    >
      <title>
        {t('hostDashboard.chartPoint', {
          month: formatMonth(month.month, locale),
          total: formatMoney(month.totalMinor, locale, currency),
        })}
      </title>
    </rect>
  );
}

function MonthLabels({ months }: { months: DashboardRevenueMonth[] }) {
  const { locale } = useLocale();

  return (
    <div
      className="grid gap-1 text-caption text-ink-muted"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, months.length)}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {months.map((month) => (
        <span key={month.month} className="truncate text-center">
          {formatMonth(month.month, locale)}
        </span>
      ))}
    </div>
  );
}

/**
 * Столбчатый график руками: шесть месяцев не стоят тяжёлой библиотеки.
 * SVG растягивается по ширине карточки без искажения текста — подписи
 * месяцев и скрытый список значений живут в HTML-слое.
 */
export function RevenueChart({ months, currency }: RevenueChartProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const max = Math.max(1, ...months.map((month) => month.totalMinor));
  const slot = (WIDTH - SIDE * 2) / Math.max(1, months.length);
  const barWidth = Math.min(32, slot * 0.56);
  const chartHeight = HEIGHT - TOP - BOTTOM;

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-36 w-full"
        role="img"
        aria-label={t('hostDashboard.chartLabel')}
      >
        <line
          x1={SIDE}
          x2={WIDTH - SIDE}
          y1={HEIGHT - BOTTOM}
          y2={HEIGHT - BOTTOM}
          className="stroke-border"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        {months.map((month, index) => {
          const raw = Math.round((month.totalMinor / max) * chartHeight);
          const height = month.totalMinor === 0 ? 2 : Math.max(4, raw);

          return (
            <Bar
              key={month.month}
              month={month}
              x={SIDE + slot * index + (slot - barWidth) / 2}
              width={barWidth}
              height={height}
              currency={currency}
            />
          );
        })}
      </svg>

      <MonthLabels months={months} />

      <ul className="sr-only" data-testid="revenue-values">
        {months.map((month) => (
          <li key={month.month}>
            {formatMonth(month.month, locale)}: {formatMoney(month.totalMinor, locale, currency)},{' '}
            {t('hostDashboard.chartPointBookings', { count: month.bookings })}
          </li>
        ))}
      </ul>
    </div>
  );
}
