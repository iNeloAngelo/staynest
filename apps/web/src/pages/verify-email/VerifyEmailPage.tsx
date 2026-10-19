import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthCard } from '../../app/layouts/AuthCard';
import { InvalidLink, TokenPasswordForm, useVerifyEmail } from '../../features/auth';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const verify = useVerifyEmail();

  if (!token) {
    return (
      <AuthCard title={t('auth.verify.title')} subtitle={t('auth.verify.subtitle')}>
        <InvalidLink />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.verify.title')} subtitle={t('auth.verify.subtitle')}>
      <TokenPasswordForm
        token={token}
        passwordLabel={t('auth.verify.password')}
        passwordHint={t('auth.verify.passwordHint')}
        submitLabel={t('auth.verify.submit')}
        submittingLabel={t('auth.verify.submitting')}
        successTitle={t('auth.verify.successTitle')}
        successBody={t('auth.verify.successBody')}
        action={(input) => verify.mutateAsync(input)}
      />
    </AuthCard>
  );
}
