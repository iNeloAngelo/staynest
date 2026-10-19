import { House } from 'lucide-react';
import { PlaceholderPage } from '../placeholder/PlaceholderPage';

export function HostListingsPage() {
  return (
    <PlaceholderPage
      icon={House}
      titleKey="pages.hostListings.title"
      emptyTitleKey="pages.hostListings.emptyTitle"
      emptyBodyKey="pages.hostListings.emptyBody"
    />
  );
}
