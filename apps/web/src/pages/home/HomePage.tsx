import { House } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CatalogView } from '../../features/catalog';
import { useMode } from '../../features/mode-switch';
import { EmptyState, buttonClassName } from '../../shared/ui';

function HostHome() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3 pt-2 lg:pt-10">
        <p className="text-small font-semibold tracking-wide text-primary uppercase">
          {t('home.host.eyebrow')}
        </p>

        <h1 className="max-w-2xl text-display text-ink lg:text-display-lg">
          {t('home.host.title')}
        </h1>

        <p className="max-w-prose text-body text-ink-muted lg:text-h3">
          {t('home.host.subtitle')}
        </p>
      </section>

      <EmptyState
        icon={<House className="size-6" aria-hidden="true" />}
        title={t('home.host.cardTitle')}
        description={t('home.host.cardBody')}
        action={
          <Link to="/host/listings" className={buttonClassName({ size: 'lg' })}>
            {t('home.host.action')}
          </Link>
        }
      />
    </div>
  );
}

export function HomePage() {
  const { mode } = useMode();

  return mode === 'host' ? <HostHome /> : <CatalogView />;
}
