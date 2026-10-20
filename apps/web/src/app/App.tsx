import { Suspense, lazy } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';
import { OfflinePage } from '../pages/offline/OfflinePage';
import { HomePage } from '../pages/home/HomePage';
import {
  BookingPage,
  FavoritesPage,
  ForgotPasswordPage,
  HostCalendarPage,
  HostDashboardPage,
  HostListingsPage,
  HostRequestsPage,
  ListingEditorPage,
  ListingPage,
  LoginPage,
  ProfilePage,
  RegisterPage,
  ResetPasswordPage,
  TripsPage,
  VerifyEmailPage,
} from './lazyPages';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { PageLoading } from './routes/PageLoading';
import { RequireAuth } from './routes/RequireAuth';
import { ScrollToTop } from './routes/ScrollToTop';
import { AppErrorBoundary } from './AppErrorBoundary';
import { useRouteSeo } from './useRouteSeo';

const DevUiPage = import.meta.env.DEV ? lazy(() => import('../pages/dev-ui/DevUiPage')) : null;

export function App() {
  const { pathname } = useLocation();
  useRouteSeo();

  return (
    <>
      <ScrollToTop />
      <AppErrorBoundary key={pathname}>
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
              <Route path="offline" element={<OfflinePage />} />

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
      </AppErrorBoundary>
    </>
  );
}
