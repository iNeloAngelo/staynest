import { useTranslation } from 'react-i18next';
import { Skeleton, SkeletonText } from '../../shared/ui/Skeleton';

export function PageLoading() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton className="h-8 w-2/3" />
      <SkeletonText lines={4} />
    </div>
  );
}
