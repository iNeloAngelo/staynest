import { CalendarDays, Heart, House, Inbox, Luggage, Search, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { ModeSwitchControl, useMode } from '../../features/mode-switch';
import { BottomNav } from '../../shared/ui/BottomNav';
import type { BottomNavItem } from '../../shared/ui/BottomNav';
import { AppHeader } from './AppHeader';

function useNavItems(): BottomNavItem[] {
  const { t } = useTranslation();
  const { mode } = useMode();

  if (mode === 'host') {
    return [
      { to: '/host/listings', label: t('nav.host.listings'), icon: House },
      { to: '/host/requests', label: t('nav.host.requests'), icon: Inbox },
      { to: '/host/calendar', label: t('nav.host.calendar'), icon: CalendarDays },
      { to: '/profile', label: t('nav.host.profile'), icon: UserRound },
    ];
  }

  return [
    { to: '/', label: t('nav.guest.search'), icon: Search, end: true },
    { to: '/favorites', label: t('nav.guest.favorites'), icon: Heart },
    { to: '/trips', label: t('nav.guest.trips'), icon: Luggage },
    { to: '/profile', label: t('nav.guest.profile'), icon: UserRound },
  ];
}

export function AppLayout() {
  const { t } = useTranslation();
  const items = useNavItems();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-small focus:font-semibold focus:text-ink"
      >
        {t('common.skipToContent')}
      </a>

      <AppHeader />

      <div className="mx-auto w-full max-w-page px-4 pt-3 lg:hidden">
        <ModeSwitchControl fullWidth />
      </div>

      <main
        id="main"
        className="mx-auto w-full max-w-page flex-1 px-4 py-6 pb-nav lg:px-8 lg:py-10"
      >
        <Outlet />
      </main>

      <BottomNav items={items} label={t('nav.mainLabel')} />
    </div>
  );
}
