import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui';
import {
  countVisit,
  dismissInstall,
  isInstallDismissed,
  isStandalone,
  shouldOfferInstall,
} from '../model/install-eligibility';
import { useInstallPrompt } from '../model/useInstallPrompt';
import { IosInstallSheet } from './IosInstallSheet';

export function InstallBanner() {
  const { t } = useTranslation();
  const [visits, setVisits] = useState(0);
  const [dismissed, setDismissed] = useState(() => isInstallDismissed());
  const [iosOpen, setIosOpen] = useState(false);
  const { available, ios, install } = useInstallPrompt();

  // Визит считается один раз за сессию вкладки: счётчик не растёт от ререндера.
  useEffect(() => setVisits(countVisit()), []);

  const eligible = shouldOfferInstall(visits);
  const visible = eligible && !dismissed && !isStandalone() && (available || ios);
  if (!visible) return null;

  function onLater(): void {
    dismissInstall();
    setDismissed(true);
  }

  async function onInstall(): Promise<void> {
    if (ios) {
      setIosOpen(true);
      return;
    }

    await install();
  }

  return (
    <>
      <div
        role="region"
        aria-label={t('pwa.install.title')}
        className="border-b border-border bg-surface px-4 py-3"
      >
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-small font-semibold text-ink">{t('pwa.install.title')}</p>
            <p className="text-caption text-ink-muted">{t('pwa.install.body')}</p>
          </div>

          <Button
            leftIcon={<Download className="size-4" aria-hidden="true" />}
            onClick={() => void onInstall()}
          >
            {t('pwa.install.action')}
          </Button>

          <Button variant="ghost" onClick={onLater}>
            {t('pwa.install.later')}
          </Button>
        </div>
      </div>

      <IosInstallSheet open={iosOpen} onClose={() => setIosOpen(false)} />
    </>
  );
}
