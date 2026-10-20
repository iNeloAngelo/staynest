import { lazy } from 'react';

// Экраны вне первого рендера подгружаются отдельными чанками:
// это уменьшает стартовый JS и время до первой отрисовки.
export const LoginPage = lazy(() =>
  import('../pages/login/LoginPage').then((module) => ({ default: module.LoginPage })),
);
export const RegisterPage = lazy(() =>
  import('../pages/register/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
export const VerifyEmailPage = lazy(() =>
  import('../pages/verify-email/VerifyEmailPage').then((module) => ({
    default: module.VerifyEmailPage,
  })),
);
export const ForgotPasswordPage = lazy(() =>
  import('../pages/forgot-password/ForgotPasswordPage').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
export const ResetPasswordPage = lazy(() =>
  import('../pages/reset-password/ResetPasswordPage').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
export const ProfilePage = lazy(() =>
  import('../pages/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
export const TripsPage = lazy(() =>
  import('../pages/trips/TripsPage').then((module) => ({ default: module.TripsPage })),
);
export const BookingPage = lazy(() =>
  import('../pages/booking/BookingPage').then((module) => ({ default: module.BookingPage })),
);
export const FavoritesPage = lazy(() =>
  import('../pages/favorites/FavoritesPage').then((module) => ({ default: module.FavoritesPage })),
);
export const HostListingsPage = lazy(() =>
  import('../pages/host-listings/HostListingsPage').then((module) => ({
    default: module.HostListingsPage,
  })),
);
export const HostRequestsPage = lazy(() =>
  import('../pages/host-requests/HostRequestsPage').then((module) => ({
    default: module.HostRequestsPage,
  })),
);
export const ListingPage = lazy(() =>
  import('../pages/listing/ListingPage').then((module) => ({ default: module.ListingPage })),
);
export const ListingEditorPage = lazy(() =>
  import('../pages/listing-editor/ListingEditorPage').then((module) => ({
    default: module.ListingEditorPage,
  })),
);
export const HostCalendarPage = lazy(() =>
  import('../pages/host-calendar/HostCalendarPage').then((module) => ({
    default: module.HostCalendarPage,
  })),
);
export const HostDashboardPage = lazy(() =>
  import('../pages/host-dashboard/HostDashboardPage').then((module) => ({
    default: module.HostDashboardPage,
  })),
);
