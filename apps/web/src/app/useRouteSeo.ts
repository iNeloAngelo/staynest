import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { TranslationKey } from '../shared/i18n';
import { useSeo } from '../shared/lib/seo';

type RouteSeo = {
  title: TranslationKey;
  description: TranslationKey;
  noindex?: boolean;
};

const PRIVATE_DESCRIPTION: TranslationKey = 'seo.private.description';

const ROUTES: Record<string, RouteSeo> = {
  '/login': { title: 'seo.login.title', description: 'seo.login.description', noindex: true },
  '/register': {
    title: 'seo.register.title',
    description: 'seo.register.description',
    noindex: true,
  },
  '/verify-email': {
    title: 'seo.verify.title',
    description: 'seo.verify.description',
    noindex: true,
  },
  '/forgot-password': {
    title: 'seo.forgot.title',
    description: 'seo.forgot.description',
    noindex: true,
  },
  '/reset-password': {
    title: 'seo.reset.title',
    description: 'seo.reset.description',
    noindex: true,
  },
  '/profile': { title: 'seo.profile.title', description: PRIVATE_DESCRIPTION, noindex: true },
  '/trips': { title: 'seo.trips.title', description: PRIVATE_DESCRIPTION, noindex: true },
  '/favorites': {
    title: 'seo.favorites.title',
    description: 'seo.favorites.description',
    noindex: true,
  },
  '/offline': {
    title: 'seo.offline.title',
    description: 'seo.offline.description',
    noindex: true,
  },
  '/host': { title: 'seo.host.title', description: 'seo.host.description', noindex: true },
  '/host/listings': {
    title: 'seo.hostListings.title',
    description: PRIVATE_DESCRIPTION,
    noindex: true,
  },
  '/host/requests': {
    title: 'seo.hostRequests.title',
    description: PRIVATE_DESCRIPTION,
    noindex: true,
  },
  '/host/calendar': {
    title: 'seo.hostCalendar.title',
    description: PRIVATE_DESCRIPTION,
    noindex: true,
  },
};

const NOT_FOUND: RouteSeo = {
  title: 'seo.notFound.title',
  description: 'seo.notFound.description',
  noindex: true,
};

/** Заголовки служебных и приватных экранов. Каталог и карточка задают SEO сами. */
function seoForRoute(pathname: string): RouteSeo | null {
  if (pathname === '/' || pathname.startsWith('/listings/')) return null;

  const exact = ROUTES[pathname];
  if (exact) return exact;

  if (pathname.startsWith('/host/listings/')) {
    return { title: 'seo.hostEditor.title', description: PRIVATE_DESCRIPTION, noindex: true };
  }

  if (pathname.startsWith('/bookings/')) {
    return { title: 'seo.booking.title', description: PRIVATE_DESCRIPTION, noindex: true };
  }

  return NOT_FOUND;
}

export function useRouteSeo(): void {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const route = seoForRoute(pathname);

  useSeo(
    route
      ? {
          title: t(route.title),
          description: t(route.description),
          noindex: route.noindex,
          image: '/og-image.jpg',
        }
      : null,
  );
}
