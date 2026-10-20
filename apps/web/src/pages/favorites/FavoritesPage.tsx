import { useTranslation } from 'react-i18next';
import { FavoritesView } from '../../features/favorites';

export function FavoritesPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-h1 text-ink">{t('pages.favorites.title')}</h1>
        <p className="mt-1 text-small text-ink-muted">{t('favorites.subtitle')}</p>
      </header>

      <FavoritesView />
    </div>
  );
}
