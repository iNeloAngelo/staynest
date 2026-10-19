import { Inbox } from 'lucide-react';
import { PlaceholderPage } from '../placeholder/PlaceholderPage';

export function HostRequestsPage() {
  return (
    <PlaceholderPage
      icon={Inbox}
      titleKey="pages.hostRequests.title"
      emptyTitleKey="pages.hostRequests.emptyTitle"
      emptyBodyKey="pages.hostRequests.emptyBody"
    />
  );
}
