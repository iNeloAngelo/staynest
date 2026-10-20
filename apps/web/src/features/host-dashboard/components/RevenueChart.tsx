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
const BOTTOM = 28;
const SIDE = 8;

function Bar({ month, x, width, height, currency }: BarProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  return (
    <g>
      <rect
        x={x}
        y={HEIGHT - BOTTOM - height}
        width={width}
        height={Math.max(0, height)}
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
      <text
        x={x + width / 2}
        y={HEIGHT - 8}
        textAnchor="middle"
        className="fill-ink-muted text-caption"
      >
        {formatMonth(month.month, locale)}
      </text>
    </g>
  );
}

/**
 * Столбчатый график руками: шесть месяцев не стоят тяжёлой библиотеки.
 * Числа дублируются скрытым списком, поэтому график доступен скринридеру.
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
        className="h-40 w-full"
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
        />

        {months.map((month, index) => (
          <Bar
            key={month.month}
            month={month}
            x={SIDE + slot * index + (slot - barWidth) / 2}
            width={barWidth}
            height={Math.round((month.totalMinor / max) * chartHeight)}
            currency={currency}
          />
        ))}
      </svg>

      <ul className="sr-only">
        {months.map((month) => (
          <li key={month.month}>
            {formatMonth(month.month, locale)}: {formatMoney(month.totalMinor, locale, currency)},{' '}
            {month.bookings}
          </li>
        ))}
      </ul>
    </div>
  );
}
