import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAutoFocus } from '../../../shared/lib/useAutoFocus';
import { Button, Input, textLink } from '../../../shared/ui';
import type { RegistrationResult } from '../model/useRegisterForm';
import { useRegisterForm } from '../model/useRegisterForm';
import { AuthErrorAlert } from './AuthErrorAlert';
import { PasswordToggle } from './PasswordToggle';

type ResultPanelProps = {
  result: RegistrationResult;
  serverError: string | null;
  resendPending: boolean;
  onResend: () => void;
};

function ResultPanel({ result, serverError, resendPending, onResend }: ResultPanelProps) {
  const { t } = useTranslation();
  const titleRef = useAutoFocus<HTMLHeadingElement>();
  const title = result.emailVerificationRequired
    ? t('auth.register.checkEmailTitle')
    : t('auth.register.readyTitle');
  const body = result.emailVerificationRequired
    ? t('auth.register.checkEmailBody', { email: result.email })
    : t('auth.register.readyBody');

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-start gap-4">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-primary">
        <Mail className="size-6" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h2 ref={titleRef} tabIndex={-1} className="text-h2 text-ink focus:outline-none">
          {title}
        </h2>
        <p className="text-body text-ink-muted">{body}</p>
      </div>

      {serverError ? <AuthErrorAlert message={serverError} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={{ pathname: '/login', search: `?email=${encodeURIComponent(result.email)}` }}
          className={textLink}
        >
          {t('auth.register.backToLogin')}
        </Link>

        {result.emailVerificationRequired ? (
          <Button variant="secondary" onClick={onResend} loading={resendPending}>
            {resendPending ? t('auth.register.resending') : t('auth.register.resend')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function LoginPrompt() {
  const { t } = useTranslation();

  return (
    <p className="text-small text-ink-muted">
      {t('auth.register.hasAccount')}{' '}
      <Link to="/login" className={textLink}>
        {t('auth.register.loginLink')}
      </Link>
    </p>
  );
}

export function RegisterForm() {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    showPassword,
    togglePassword,
    serverError,
    result,
    resendPending,
    resendEmail,
    submit,
  } = useRegisterForm();

  if (result) {
    return (
      <ResultPanel
        result={result}
        serverError={serverError}
        resendPending={resendPending}
        onResend={resendEmail}
      />
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      {serverError ? <AuthErrorAlert message={serverError} /> : null}

      <Input
        label={t('auth.register.displayName')}
        autoComplete="name"
        error={errors.displayName?.message}
        {...register('displayName')}
      />

      <Input
        label={t('auth.register.email')}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label={t('auth.register.password')}
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        hint={t('auth.register.passwordHint')}
        error={errors.password?.message}
        suffix={<PasswordToggle visible={showPassword} onToggle={togglePassword} />}
        {...register('password')}
      />

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        {isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')}
      </Button>

      <LoginPrompt />
    </form>
  );
}
