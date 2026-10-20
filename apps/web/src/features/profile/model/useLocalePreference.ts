import type { Locale } from '@staynest/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../../shared/i18n';
import { useToast } from '../../../shared/ui';
import { useMe } from '../../auth';
import { useUpdateProfile } from '../api/hooks';

/**
 * Язык применяется сразу, а при входе сохраняется в профиле: письма и push
 * должны приходить на выбранном языке. При ошибке API локаль откатывается,
 * иначе интерфейс и сервер расходятся.
 */
export function useLocalePreference() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const { data: user } = useMe();
  const update = useUpdateProfile();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function changeLocale(next: Locale): Promise<void> {
    if (next === locale) return;

    const previous = locale;
    setLocale(next);
    if (!user) return;

    setPending(true);
    try {
      await update.mutateAsync({ locale: next });
    } catch {
      setLocale(previous);
      toast.show({ title: t('profile.saveError'), tone: 'error' });
    } finally {
      setPending(false);
    }
  }

  return { locale, changeLocale, pending };
}
