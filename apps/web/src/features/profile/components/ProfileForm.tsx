import { zodResolver } from '@hookform/resolvers/zod';
import type { UserDto } from '@staynest/shared';
import { displayNameSchema } from '@staynest/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Input, useToast } from '../../../shared/ui';
import { useUpdateProfile } from '../api/hooks';

type ProfileValues = { displayName: string; phone: string };

function profileFormSchema(phoneMessage: string) {
  return z.object({
    displayName: displayNameSchema,
    phone: z.string().trim().max(32, phoneMessage),
  });
}

export function ProfileForm({ user }: { user: UserDto }) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateProfile();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileFormSchema(t('profile.phoneInvalid'))),
    defaultValues: { displayName: user.displayName, phone: user.phone ?? '' },
  });

  async function submit(values: ProfileValues): Promise<void> {
    setServerError(null);
    const phone = values.phone.trim();

    try {
      await update.mutateAsync({
        displayName: values.displayName.trim(),
        phone: phone === '' ? null : phone,
      });
      toast.show({ title: t('profile.saved'), tone: 'success' });
    } catch {
      setServerError(t('profile.saveError'));
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
      <h2 className="font-serif text-h3 text-ink">{t('profile.editTitle')}</h2>

      <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        {serverError ? (
          <p role="alert" className="text-small text-danger">
            {serverError}
          </p>
        ) : null}

        <Input
          label={t('profile.name')}
          autoComplete="name"
          error={errors.displayName?.message}
          {...register('displayName')}
        />

        <Input
          label={t('profile.phone')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint={t('profile.phoneHint')}
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Button type="submit" loading={isSubmitting} className="w-fit">
          {isSubmitting ? t('profile.saving') : t('profile.save')}
        </Button>
      </form>
    </section>
  );
}
