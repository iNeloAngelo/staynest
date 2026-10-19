import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EmptyState, buttonClassName } from '../../shared/ui';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={<Compass className="size-6" aria-hidden="true" />}
      titleAs="h1"
      title={t('notFound.title')}
      description={t('notFound.body')}
      action={
        <Link to="/" className={buttonClassName()}>
          {t('notFound.action')}
        </Link>
      }
    />
  );
}
