import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../../features/auth';
import { Button, EmptyState } from '../../shared/ui';
import { PageLoading } from './PageLoading';

export function RequireAuth() {
  const { t } = useTranslation();
  const { data: user, isPending, isError, refetch } = useMe();
  const location = useLocation();

  if (isPending) return <PageLoading />;

  if (isError) {
    return (
      <EmptyState
        icon={<ShieldAlert className="size-6" aria-hidden="true" />}
        titleAs="h1"
        title={t('auth.sessionError.title')}
        description={t('auth.sessionError.body')}
        action={
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
