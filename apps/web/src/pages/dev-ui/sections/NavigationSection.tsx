import { CalendarDays, Heart, House, Inbox, Luggage, Search, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModeSwitchControl, useMode } from '../../../features/mode-switch';
import { BottomNav } from '../../../shared/ui';

export function NavigationSection() {
  const { t } = useTranslation();
  const { mode } = useMode();

  const items =
    mode === 'host'
      ? [
          { to: '/dev/ui', label: t('nav.host.listings'), icon: House },
          { to: '/dev/ui?requests', label: t('nav.host.requests'), icon: Inbox },
          { to: '/dev/ui?calendar', label: t('nav.host.calendar'), icon: CalendarDays },
          { to: '/dev/ui?profile', label: t('nav.host.profile'), icon: UserRound },
        ]
      : [
          { to: '/dev/ui', label: t('nav.guest.search'), icon: Search, end: true },
          { to: '/dev/ui?favorites', label: t('nav.guest.favorites'), icon: Heart },
          { to: '/dev/ui?trips', label: t('nav.guest.trips'), icon: Luggage },
          { to: '/dev/ui?profile', label: t('nav.guest.profile'), icon: UserRound },
        ];

  return (
    <section aria-labelledby="dev-navigation" className="flex flex-col gap-4">
      <h2 id="dev-navigation" className="text-h2 text-ink">
        {t('dev.section.navigation')}
      </h2>

      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-small font-semibold text-ink">{t('dev.navigation.mode')}</h3>
          <ModeSwitchControl />
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-small font-semibold text-ink">{t('dev.navigation.bottomNav')}</h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <BottomNav items={items} label={t('nav.mainLabel')} inline />
          </div>
        </div>
      </div>
    </section>
  );
}
