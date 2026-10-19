import { House } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMode } from '../../features/mode-switch';
import { EmptyState, buttonClassName } from '../../shared/ui';

export function HomePage() {
  const { t } = useTranslation();
  const { mode } = useMode();
  const host = mode === 'host';

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3 pt-2 lg:pt-10">
        <p className="text-small font-semibold tracking-wide text-primary uppercase">
          {t(host ? 'home.host.eyebrow' : 'home.guest.eyebrow')}
        </p>

        <h1 className="max-w-2xl text-display text-ink lg:text-display-lg">
          {t(host ? 'home.host.title' : 'home.guest.title')}
        </h1>

        <p className="max-w-prose text-body text-ink-muted lg:text-h3">
          {t(host ? 'home.host.subtitle' : 'home.guest.subtitle')}
        </p>
      </section>

      <EmptyState
        icon={<House className="size-6" aria-hidden="true" />}
        title={t(host ? 'home.host.cardTitle' : 'home.guest.cardTitle')}
        description={t(host ? 'home.host.cardBody' : 'home.guest.cardBody')}
        action={
          <Link
            to={host ? '/host/listings' : '/register'}
            className={buttonClassName({ size: 'lg' })}
          >
            {t(host ? 'home.host.action' : 'home.guest.action')}
          </Link>
        }
      />
    </div>
  );
}
