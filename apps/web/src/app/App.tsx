import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { FavoritesPage } from '../pages/favorites/FavoritesPage';
import { ForgotPasswordPage } from '../pages/forgot-password/ForgotPasswordPage';
import { BookingPage } from '../pages/booking/BookingPage';
import { HostListingsPage } from '../pages/host-listings/HostListingsPage';
import { HostRequestsPage } from '../pages/host-requests/HostRequestsPage';
import { LoginPage } from '../pages/login/LoginPage';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { RegisterPage } from '../pages/register/RegisterPage';
import { ResetPasswordPage } from '../pages/reset-password/ResetPasswordPage';
import { TripsPage } from '../pages/trips/TripsPage';
import { VerifyEmailPage } from '../pages/verify-email/VerifyEmailPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { PageLoading } from './routes/PageLoading';
import { RequireAuth } from './routes/RequireAuth';
import { ScrollToTop } from './routes/ScrollToTop';

// Тяжёлые экраны (календарь, мастер с загрузчиком фото, каталог) — отдельными чанками.
const HomePage = lazy(() =>
  import('../pages/home/HomePage').then((m) => ({ default: m.HomePage })),
);
const ListingPage = lazy(() =>
  import('../pages/listing/ListingPage').then((m) => ({ default: m.ListingPage })),
);
const ListingEditorPage = lazy(() =>
  import('../pages/listing-editor/ListingEditorPage').then((m) => ({
    default: m.ListingEditorPage,
  })),
);
const HostCalendarPage = lazy(() =>
  import('../pages/host-calendar/HostCalendarPage').then((m) => ({ default: m.HostCalendarPage })),
);
const HostDashboardPage = lazy(() =>
  import('../pages/host-dashboard/HostDashboardPage').then((m) => ({
    default: m.HostDashboardPage,
  })),
);

const DevUiPage = import.meta.env.DEV ? lazy(() => import('../pages/dev-ui/DevUiPage')) : null;

export function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="listings/:id" element={<ListingPage />} />

            <Route element={<RequireAuth />}>
              <Route path="profile" element={<ProfilePage />} />
              <Route path="trips" element={<TripsPage />} />
              <Route path="bookings/:id" element={<BookingPage />} />
              <Route path="favorites" element={<FavoritesPage />} />
              <Route path="host" element={<HostDashboardPage />} />
              <Route path="host/listings" element={<HostListingsPage />} />
              <Route path="host/listings/:id" element={<ListingEditorPage />} />
              <Route path="host/requests" element={<HostRequestsPage />} />
              <Route path="host/calendar" element={<HostCalendarPage />} />
            </Route>

            {DevUiPage ? (
              <Route
                path="dev/ui"
                element={
                  <Suspense fallback={<PageLoading />}>
                    <DevUiPage />
                  </Suspense>
                }
              />
            ) : null}

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
