import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMe } from '../../auth';
import { hapticImpact } from '../../telegram';
import { cn } from '../../../shared/lib/cn';
import { useOnline } from '../../../shared/lib/useOnline';
import { useToast } from '../../../shared/ui';
import { useFavoriteIds, useToggleFavorite } from '../api/hooks';

type FavoriteButtonProps = {
  listingId: string;
  className?: string;
};

/**
 * Сердечко избранного. Для анонима ведёт на вход и возвращает обратно,
 * для пользователя — оптимистично переключает общий кэш id.
 */
export function FavoriteButton({ listingId, className }: FavoriteButtonProps) {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const { data: ids = [] } = useFavoriteIds(Boolean(user));
  const toggle = useToggleFavorite();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnline();
  const isFavorite = ids.includes(listingId);

  function onClick(): void {
    hapticImpact();
    if (!online) {
      toast.show({ title: t('pwa.actionsOffline'), tone: 'error' });
      return;
    }

    if (!user) {
      const next = `${location.pathname}${location.search}`;
      navigate(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    toggle.mutate(
      { listingId, favorite: !isFavorite },
      { onError: () => toast.show({ title: t('favorites.error'), tone: 'error' }) },
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={!online}
      title={online ? undefined : t('pwa.actionsOffline')}
      aria-pressed={isFavorite}
      aria-label={t(isFavorite ? 'favorites.remove' : 'favorites.add')}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface/90 shadow-sm backdrop-blur',
        'transition-colors duration-micro',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        !online && 'cursor-not-allowed opacity-50',
        isFavorite ? 'text-danger' : 'text-ink-muted hover:text-danger',
        className,
      )}
    >
      <Heart
        className={cn('size-5', isFavorite && 'fill-current')}
        aria-hidden="true"
        strokeWidth={1.75}
      />
    </button>
  );
}
