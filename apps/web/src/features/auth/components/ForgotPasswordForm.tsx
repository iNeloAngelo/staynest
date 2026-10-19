import { zodResolver } from '@hookform/resolvers/zod';
import type { ForgotPasswordInput } from '@staynest/shared';
import { forgotPasswordInputSchema } from '@staynest/shared';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../../shared/ui';
import { useForgotPassword } from '../api/hooks';
import { authErrorKey } from '../model/errors';
import { AuthErrorAlert } from './AuthErrorAlert';
import { AuthSuccess } from './AuthSuccess';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const forgot = useForgotPassword();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordInputSchema),
    defaultValues: { email: '' },
  });

  async function submit(values: ForgotPasswordInput): Promise<void> {
    setServerError(null);

    try {
      await forgot.mutateAsync(values.email);
      setSent(true);
    } catch (error) {
      setServerError(t(authErrorKey(error)));
    }
  }

  if (sent) {
    return (
      <AuthSuccess
        title={t('auth.forgot.sentTitle')}
        body={t('auth.forgot.sentBody')}
        icon={<Mail className="size-6" aria-hidden="true" />}
      />
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      {serverError ? <AuthErrorAlert message={serverError} /> : null}

      <Input
        label={t('auth.forgot.email')}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        error={errors.email?.message}
        {...register('email')}
      />

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        {isSubmitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
      </Button>
    </form>
  );
}
