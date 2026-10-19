import { zodResolver } from '@hookform/resolvers/zod';
import type { RegisterInput } from '@staynest/shared';
import { registerInputSchema } from '@staynest/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../../shared/i18n';
import { useToast } from '../../../shared/ui';
import { useRegister, useResendVerification } from '../api/hooks';
import { authErrorKey } from './errors';

export type RegisterFormValues = Omit<RegisterInput, 'locale'> & {
  locale?: RegisterInput['locale'];
};

export type RegistrationResult = {
  email: string;
  emailVerificationRequired: boolean;
};

export function useRegisterForm() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const toast = useToast();
  const registerMutation = useRegister();
  const resend = useResendVerification();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerInputSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  async function submit(values: RegisterFormValues): Promise<void> {
    setServerError(null);

    try {
      // Локаль берём в момент отправки: переключатель мог измениться после первого рендера.
      const response = await registerMutation.mutateAsync({ ...values, locale });
      setResult({
        email: values.email,
        emailVerificationRequired: response.emailVerificationRequired,
      });
    } catch (error) {
      setServerError(t(authErrorKey(error)));
    }
  }

  function resendEmail(): void {
    if (!result) return;

    void resend
      .mutateAsync(result.email)
      .then(() => toast.show({ title: t('auth.register.resent'), tone: 'success' }))
      .catch((error: unknown) => setServerError(t(authErrorKey(error))));
  }

  return {
    ...form,
    showPassword,
    togglePassword: () => setShowPassword((current) => !current),
    serverError,
    result,
    resendPending: resend.isPending,
    resendEmail,
    submit,
  };
}
