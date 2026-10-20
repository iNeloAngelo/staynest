import {
  CalendarDays,
  Heart,
  House,
  Inbox,
  LayoutDashboard,
  Luggage,
  Search,
  UserRound,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import { ModeSwitchControl, useMode } from '../../features/mode-switch';
import { InstallBanner, OfflineBanner, UpdateBanner } from '../../features/pwa';
import { TelegramShell } from '../../features/telegram';
import { BottomNav } from '../../shared/ui/BottomNav';
import type { BottomNavItem } from '../../shared/ui/BottomNav';
import { AppHeader } from './AppHeader';

function useNavItems(hostMode: boolean): BottomNavItem[] {
  const { t } = useTranslation();

  if (hostMode) {
    return [
      { to: '/host', label: t('nav.host.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/host/listings', label: t('nav.host.listings'), icon: House },
      { to: '/host/requests', label: t('nav.host.requests'), icon: Inbox },
      { to: '/host/calendar', label: t('nav.host.calendar'), icon: CalendarDays },
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
  const location = useLocation();
  const { mode, setMode } = useMode();
  const hostRoute = location.pathname.startsWith('/host');
  const syncedHost = useRef(false);

  useEffect(() => {
    if (!hostRoute) {
      syncedHost.current = false;
      return;
    }

    if (!syncedHost.current) {
      syncedHost.current = true;
      if (mode !== 'host') setMode('host');
    }
  }, [hostRoute, mode, setMode]);

  const items = useNavItems(mode === 'host' || hostRoute);

  return (
    <div className="flex min-h-dvh flex-col">
      <TelegramShell />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-small focus:font-semibold focus:text-ink"
      >
        {t('common.skipToContent')}
      </a>

      <AppHeader />

      <OfflineBanner />
      <UpdateBanner />
      <InstallBanner />

      <nav aria-label={t('mode.label')} className="mx-auto w-full max-w-page px-4 pt-3 lg:hidden">
        <ModeSwitchControl fullWidth />
      </nav>

      <main
        id="main"
        className="mx-auto w-full max-w-page flex-1 px-4 py-6 pb-nav lg:px-8 lg:py-10"
      >
        <div key={location.pathname} className="animate-page">
          <Outlet />
        </div>
      </main>

      <BottomNav items={items} label={t('nav.mainLabel')} />
    </div>
  );
}
