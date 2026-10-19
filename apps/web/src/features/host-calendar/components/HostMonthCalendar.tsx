import type { HostCalendarResponse } from '@staynest/shared';
import { addDays } from '@staynest/shared';
import { DayPicker } from 'react-day-picker';
import type { DateRange, ModifiersClassNames } from 'react-day-picker';
import { enUS, ru as ruLocale } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
import { calendarClassNames } from '../../../shared/ui/calendarStyles';
import { formatIsoDateLocal, formatLongDate, parseIsoDateLocal } from '../../../shared/lib/dates';
import { calendarModifiers } from '../model/calendar';

const MODIFIERS: ModifiersClassNames = {
  pending:
    '[&>button]:bg-warning/20 [&>button]:text-warning-ink [&>button]:font-semibold [&>button]:underline [&>button]:decoration-2',
  confirmed:
    '[&>button]:bg-success/20 [&>button]:font-semibold [&>button]:text-success-ink [&>button]:ring-1 [&>button]:ring-success',
  blocked: '[&>button]:bg-ink-muted/15 [&>button]:text-ink-muted [&>button]:line-through',
};

export function HostMonthCalendar({
  calendar,
  month,
  selected,
  onMonthChange,
  onSelect,
}: {
  calendar: HostCalendarResponse;
  month: Date;
  selected: DateRange | undefined;
  onMonthChange: (month: Date) => void;
  onSelect: (date: Date) => void;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const modifiers = calendarModifiers(calendar);

  function dayLabel(date: Date, flags: Record<string, boolean>): string {
    const iso = formatIsoDateLocal(date);
    const afterWindow = iso > addDays(calendar.to, -1);
    const status = flags.pending
      ? t('hostCalendar.legend.pending')
      : flags.confirmed
        ? t('hostCalendar.legend.confirmed')
        : flags.blocked
          ? t('hostCalendar.legend.blocked')
          : afterWindow
            ? t('booking.dayBlocked')
            : flags.disabled
              ? t('booking.dayPast')
              : flags.selected
                ? t('booking.daySelected')
                : t('booking.dayAvailable');

    return `${formatLongDate(iso, language)}, ${status}`;
  }

  return (
    <DayPicker
      mode="range"
      selected={selected}
      onSelect={(_range, triggerDate) => onSelect(triggerDate)}
      month={month}
      onMonthChange={onMonthChange}
      weekStartsOn={1}
      showOutsideDays
      fixedWeeks
      locale={language.startsWith('en') ? enUS : ruLocale}
      lang={language}
      aria-label={t('hostCalendar.calendarLabel')}
      classNames={calendarClassNames}
      modifiers={modifiers}
      modifiersClassNames={MODIFIERS}
      today={parseIsoDateLocal(calendar.today)}
      disabled={[
        { before: parseIsoDateLocal(calendar.today) },
        { after: parseIsoDateLocal(addDays(calendar.to, -1)) },
      ]}
      endMonth={parseIsoDateLocal(addDays(calendar.to, -1))}
      labels={{ labelDayButton: dayLabel }}
    />
  );
}
