import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { AuthCard } from '../../app/layouts/AuthCard';
import { PageLoading } from '../../app/routes/PageLoading';
import { RegisterForm, useMe } from '../../features/auth';

export function RegisterPage() {
  const { t } = useTranslation();
  const { data: user, isPending } = useMe();

  if (isPending) return <PageLoading />;
  if (user) return <Navigate to="/" replace />;

  return (
    <AuthCard title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      <RegisterForm />
    </AuthCard>
  );
}
