import type { CalendarResponse } from '@staynest/shared';
import { addDays } from '@staynest/shared';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { enUS, ru as ruLocale } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
import { calendarClassNames, calendarModifiersClassNames } from '../../../shared/ui/calendarStyles';
import { formatIsoDateLocal, formatLongDate, parseIsoDateLocal } from '../../../shared/lib/dates';

type BookingCalendarProps = {
  calendar: CalendarResponse;
  selected: DateRange | undefined;
  numberOfMonths?: number;
  onSelect: (date: Date) => void;
  onMonthChange?: (month: Date) => void;
  month?: Date;
};

function busyDates(calendar: CalendarResponse): { booked: Date[]; blocked: Date[] } {
  const booked: Date[] = [];
  const blocked: Date[] = [];

  for (const night of calendar.unavailable) {
    const date = parseIsoDateLocal(night.date);
    if (night.kind === 'booked') booked.push(date);
    else blocked.push(date);
  }

  return { booked, blocked };
}

export function BookingCalendar({
  calendar,
  selected,
  numberOfMonths = 1,
  onSelect,
  onMonthChange,
  month,
}: BookingCalendarProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { booked, blocked } = busyDates(calendar);

  function dayLabel(date: Date, modifiers: Record<string, boolean>): string {
    const iso = formatIsoDateLocal(date);
    const afterWindow = iso > addDays(calendar.to, -1);
    const status = modifiers.booked
      ? t('booking.dayBooked')
      : modifiers.blocked
        ? t('booking.dayBlocked')
        : afterWindow
          ? t('booking.dayBlocked')
          : modifiers.disabled
            ? t('booking.dayPast')
            : modifiers.selected
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
      numberOfMonths={numberOfMonths}
      weekStartsOn={1}
      showOutsideDays
      fixedWeeks
      locale={language.startsWith('en') ? enUS : ruLocale}
      lang={language}
      aria-label={t('booking.calendarLabel')}
      classNames={calendarClassNames}
      modifiers={{ booked, blocked }}
      modifiersClassNames={calendarModifiersClassNames}
      startMonth={parseIsoDateLocal(calendar.today)}
      endMonth={parseIsoDateLocal(addDays(calendar.to, -1))}
      today={parseIsoDateLocal(calendar.today)}
      disabled={[
        { before: parseIsoDateLocal(calendar.today) },
        { after: parseIsoDateLocal(addDays(calendar.to, -1)) },
      ]}
      labels={{ labelDayButton: dayLabel }}
    />
  );
}
