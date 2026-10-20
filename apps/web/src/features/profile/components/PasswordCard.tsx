import { zodResolver } from '@hookform/resolvers/zod';
import type { ChangePasswordInput } from '@staynest/shared';
import { changePasswordInputSchema } from '@staynest/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Input, useToast } from '../../../shared/ui';
import { useChangePassword } from '../api/hooks';

export function PasswordCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const change = useChangePassword();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordInputSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  async function submit(values: ChangePasswordInput): Promise<void> {
    setServerError(null);

    try {
      await change.mutateAsync(values);
      toast.show({ title: t('profile.passwordChanged'), tone: 'success' });
      navigate('/login', { replace: true });
    } catch {
      setServerError(t('profile.passwordError'));
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
      <div>
        <h2 className="font-serif text-h3 text-ink">{t('profile.passwordTitle')}</h2>
        <p className="mt-1 text-small text-ink-muted">{t('profile.passwordDescription')}</p>
      </div>

      <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        {serverError ? (
          <p role="alert" className="text-small text-danger">
            {serverError}
          </p>
        ) : null}

        <Input
          label={t('profile.currentPassword')}
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />

        <Input
          label={t('profile.newPassword')}
          type="password"
          autoComplete="new-password"
          hint={t('profile.newPasswordHint')}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />

        <Button type="submit" variant="secondary" loading={isSubmitting} className="w-fit">
          {isSubmitting ? t('profile.changingPassword') : t('profile.changePassword')}
        </Button>
      </form>
    </section>
  );
}
