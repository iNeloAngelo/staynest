import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@staynest/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Input } from '../../../shared/ui';
import { authErrorKey } from '../model/errors';
import { AuthErrorAlert } from './AuthErrorAlert';
import { AuthSuccess } from './AuthSuccess';
import { PasswordToggle } from './PasswordToggle';

const passwordOnlySchema = z.object({ password: passwordSchema });

type PasswordValues = z.infer<typeof passwordOnlySchema>;

export type TokenPasswordFormProps = {
  token: string;
  passwordLabel: string;
  passwordHint: string;
  submitLabel: string;
  submittingLabel: string;
  successTitle: string;
  successBody: string;
  action: (input: { token: string; password: string }) => Promise<unknown>;
};

export function TokenPasswordForm({
  token,
  passwordLabel,
  passwordHint,
  submitLabel,
  submittingLabel,
  successTitle,
  successBody,
  action,
}: TokenPasswordFormProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordOnlySchema),
    defaultValues: { password: '' },
  });

  async function submit(values: PasswordValues): Promise<void> {
    setServerError(null);

    try {
      await action({ token, password: values.password });
      setDone(true);
    } catch (error) {
      setServerError(t(authErrorKey(error)));
    }
  }

  if (done) return <AuthSuccess title={successTitle} body={successBody} />;

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      {serverError ? <AuthErrorAlert message={serverError} /> : null}

      <Input
        label={passwordLabel}
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        hint={passwordHint}
        error={errors.password?.message}
        suffix={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
        }
        {...register('password')}
      />

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        {isSubmitting ? submittingLabel : submitLabel}
      </Button>
    </form>
  );
}
