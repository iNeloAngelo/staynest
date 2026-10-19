import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AuthCard } from '../../app/layouts/AuthCard';
import { PageLoading } from '../../app/routes/PageLoading';
import { LoginForm, safeNext, useMe } from '../../features/auth';

export function LoginPage() {
  const { t } = useTranslation();
  const { data: user, isPending } = useMe();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  if (isPending) return <PageLoading />;
  if (user) return <Navigate to={next} replace />;

  return (
    <AuthCard title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <LoginForm defaultEmail={params.get('email') ?? ''} next={next} />
    </AuthCard>
  );
}
