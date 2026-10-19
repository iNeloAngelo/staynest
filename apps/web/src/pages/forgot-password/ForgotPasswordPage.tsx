import { useTranslation } from 'react-i18next';
import { AuthCard } from '../../app/layouts/AuthCard';
import { ForgotPasswordForm } from '../../features/auth';

export function ForgotPasswordPage() {
  const { t } = useTranslation();

  return (
    <AuthCard title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
