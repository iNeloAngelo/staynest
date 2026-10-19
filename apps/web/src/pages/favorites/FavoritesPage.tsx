import { Heart } from 'lucide-react';
import { PlaceholderPage } from '../placeholder/PlaceholderPage';

export function FavoritesPage() {
  return (
    <PlaceholderPage
      icon={Heart}
      titleKey="pages.favorites.title"
      emptyTitleKey="pages.favorites.emptyTitle"
      emptyBodyKey="pages.favorites.emptyBody"
    />
  );
}
