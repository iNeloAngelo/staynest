import { zodResolver } from '@hookform/resolvers/zod';
import type { LoginInput } from '@staynest/shared';
import { loginInputSchema } from '@staynest/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../../shared/api';
import { useToast } from '../../../shared/ui';
import { useLogin, useResendVerification } from '../api/hooks';
import { authErrorKey } from './errors';
import { safeNext } from './next';

export type LoginFormOptions = {
  defaultEmail?: string;
  next?: string;
};

export function useLoginForm({ defaultEmail = '', next = '/' }: LoginFormOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const login = useLogin();
  const resend = useResendVerification();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailNotVerified, setEmailNotVerified] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: defaultEmail, password: '' },
  });

  async function submit(values: LoginInput): Promise<void> {
    setServerError(null);
    setEmailNotVerified(false);

    try {
      await login.mutateAsync(values);
      toast.show({ title: t('toast.loginSuccess'), tone: 'success' });
      navigate(safeNext(next), { replace: true });
    } catch (error) {
      setServerError(t(authErrorKey(error)));
      setEmailNotVerified(error instanceof ApiError && error.code === 'email_not_verified');
    }
  }

  async function resendEmail(): Promise<void> {
    try {
      await resend.mutateAsync(form.getValues('email'));
      toast.show({ title: t('auth.register.resent'), tone: 'success' });
    } catch (error) {
      setServerError(t(authErrorKey(error)));
    }
  }

  return {
    ...form,
    showPassword,
    togglePassword: () => setShowPassword((current) => !current),
    serverError,
    emailNotVerified,
    resendPending: resend.isPending,
    resendEmail,
    submit,
  };
}
