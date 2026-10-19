import { CalendarDays } from 'lucide-react';
import { PlaceholderPage } from '../placeholder/PlaceholderPage';

export function HostCalendarPage() {
  return (
    <PlaceholderPage
      icon={CalendarDays}
      titleKey="pages.hostCalendar.title"
      emptyTitleKey="pages.hostCalendar.emptyTitle"
      emptyBodyKey="pages.hostCalendar.emptyBody"
    />
  );
}
