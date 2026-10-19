import { House } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function LogoLink() {
  const { t } = useTranslation();

  return (
    <Link
      to="/"
      aria-label={t('header.home')}
      className="flex min-h-11 items-center gap-2 rounded-md"
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-primary text-on-primary">
        <House className="size-5" aria-hidden="true" strokeWidth={1.75} />
      </span>
      <span className="font-serif text-h3 font-semibold text-ink">{t('common.appName')}</span>
    </Link>
  );
}
