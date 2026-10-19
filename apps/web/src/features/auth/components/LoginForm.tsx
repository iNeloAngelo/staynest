import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, Input, textLink } from '../../../shared/ui';
import { useLoginForm } from '../model/useLoginForm';
import type { LoginFormOptions } from '../model/useLoginForm';
import { AuthErrorAlert } from './AuthErrorAlert';
import { PasswordToggle } from './PasswordToggle';

function EmailNotVerifiedNotice({ pending, onResend }: { pending: boolean; onResend: () => void }) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-md border border-warning/40 bg-warning/8 p-4"
    >
      <h2 className="text-h3 text-ink">{t('auth.emailNotVerified.title')}</h2>
      <p className="text-small text-ink-muted">{t('auth.emailNotVerified.body')}</p>
      <Button variant="secondary" onClick={onResend} loading={pending}>
        {pending ? t('auth.register.resending') : t('auth.register.resend')}
      </Button>
    </div>
  );
}

export function LoginForm({ defaultEmail, next }: LoginFormOptions) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    showPassword,
    togglePassword,
    serverError,
    emailNotVerified,
    resendPending,
    resendEmail,
    submit,
  } = useLoginForm({ defaultEmail, next });

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      {serverError && !emailNotVerified ? <AuthErrorAlert message={serverError} /> : null}

      {emailNotVerified ? (
        <EmailNotVerifiedNotice pending={resendPending} onResend={() => void resendEmail()} />
      ) : null}

      <Input
        label={t('auth.login.email')}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label={t('auth.login.password')}
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        error={errors.password?.message}
        suffix={<PasswordToggle visible={showPassword} onToggle={togglePassword} />}
        {...register('password')}
      />

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-small text-ink-muted">
        <p>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className={textLink}>
            {t('auth.login.registerLink')}
          </Link>
        </p>

        <Link to="/forgot-password" className={textLink}>
          {t('auth.login.forgotPassword')}
        </Link>
      </div>
    </form>
  );
}
