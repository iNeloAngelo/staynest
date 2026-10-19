import { Luggage } from 'lucide-react';
import { PlaceholderPage } from '../placeholder/PlaceholderPage';

export function TripsPage() {
  return (
    <PlaceholderPage
      icon={Luggage}
      titleKey="pages.trips.title"
      emptyTitleKey="pages.trips.emptyTitle"
      emptyBodyKey="pages.trips.emptyBody"
    />
  );
}
