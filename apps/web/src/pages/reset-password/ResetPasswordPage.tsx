import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthCard } from '../../app/layouts/AuthCard';
import { InvalidLink, TokenPasswordForm, useResetPassword } from '../../features/auth';
import { textLink } from '../../shared/ui';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();

  if (!token) {
    return (
      <AuthCard title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
        <InvalidLink
          action={
            <Link to="/forgot-password" className={textLink}>
              {t('auth.login.forgotPassword')}
            </Link>
          }
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      <TokenPasswordForm
        token={token}
        passwordLabel={t('auth.reset.password')}
        passwordHint={t('auth.reset.passwordHint')}
        submitLabel={t('auth.reset.submit')}
        submittingLabel={t('auth.reset.submitting')}
        successTitle={t('auth.reset.successTitle')}
        successBody={t('auth.reset.successBody')}
        action={(input) => reset.mutateAsync(input)}
      />
    </AuthCard>
  );
}
