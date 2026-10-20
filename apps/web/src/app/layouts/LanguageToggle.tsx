import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocalePreference } from '../../features/profile';

export function LanguageToggle() {
  const { t } = useTranslation();
  const { locale, changeLocale, pending } = useLocalePreference();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void changeLocale(locale === 'ru' ? 'en' : 'ru')}
      aria-label={`${t('common.languageSwitch')}: ${locale.toUpperCase()}`}
      title={t('common.languageCurrent')}
      className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-small font-semibold text-ink-muted transition-colors duration-micro hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Languages className="size-5" aria-hidden="true" />
      <span lang={locale}>{locale.toUpperCase()}</span>
    </button>
  );
}
