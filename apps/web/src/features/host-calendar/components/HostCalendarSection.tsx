import type { HostCalendarResponse } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import type { IsoRange } from '../../booking/model/selection';
import { selectedDayPickerRange } from '../model/calendar';
import { HostMonthCalendar } from './HostMonthCalendar';

export function HostCalendarSection({
  calendar,
  month,
  range,
  notice,
  onMonthChange,
  onSelect,
}: {
  calendar: HostCalendarResponse;
  month: Date;
  range: IsoRange | undefined;
  notice: string | null;
  onMonthChange: (month: Date) => void;
  onSelect: (date: Date) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-0 sm:p-4">
      <div className="px-1 pt-3 sm:px-0 sm:pt-0">
        <HostMonthCalendar
          calendar={calendar}
          month={month}
          selected={selectedDayPickerRange(range)}
          onMonthChange={onMonthChange}
          onSelect={onSelect}
        />
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-3 text-caption text-ink-muted sm:px-0">
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
          {t('hostCalendar.legend.pending')}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" aria-hidden="true" />
          {t('hostCalendar.legend.confirmed')}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink-muted/50" aria-hidden="true" />
          {t('hostCalendar.legend.blocked')}
        </li>
      </ul>

      <p
        role="status"
        aria-live="polite"
        className="min-h-5 px-3 pb-3 text-small text-ink-muted sm:px-0 sm:pb-0"
      >
        {notice ?? t('hostCalendar.selectHint')}
      </p>
    </section>
  );
}
