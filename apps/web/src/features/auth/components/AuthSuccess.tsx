import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAutoFocus } from '../../../shared/lib/useAutoFocus';
import { textLink } from '../../../shared/ui';

export type AuthSuccessProps = {
  title: string;
  body: string;
  icon?: ReactNode;
};

export function AuthSuccess({ title, body, icon }: AuthSuccessProps) {
  const { t } = useTranslation();
  const titleRef = useAutoFocus<HTMLHeadingElement>();

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-start gap-4">
      <span className="flex size-12 items-center justify-center rounded-full bg-success/12 text-success">
        {icon ?? <CheckCircle2 className="size-6" aria-hidden="true" />}
      </span>

      <div className="flex flex-col gap-2">
        <h2 ref={titleRef} tabIndex={-1} className="text-h2 text-ink focus:outline-none">
          {title}
        </h2>
        <p className="text-body text-ink-muted">{body}</p>
      </div>

      <Link to="/login" className={textLink}>
        {t('auth.link.toLogin')}
      </Link>
    </div>
  );
}
