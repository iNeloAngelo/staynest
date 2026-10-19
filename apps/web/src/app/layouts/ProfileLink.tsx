import type { UserDto } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonClassName } from '../../shared/ui';

function initials(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase() || '?';
}

export function ProfileLink({ user }: { user: UserDto }) {
  const { t } = useTranslation();

  return (
    <Link
      to="/profile"
      aria-label={t('header.profileOf', { name: user.displayName })}
      className="flex size-11 items-center justify-center rounded-full bg-primary text-body font-semibold text-on-primary"
    >
      {initials(user.displayName)}
    </Link>
  );
}

export function LoginLink() {
  const { t } = useTranslation();

  return (
    <Link to="/login" className={buttonClassName({ variant: 'secondary' })}>
      {t('header.login')}
    </Link>
  );
}
