import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../shared/ui';
import { demoNotification, demoUser, mockApi } from '../../../test/api-mocks';
import { NotificationBell } from './NotificationBell';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <NotificationBell enabled userId={demoUser.id} />
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('колокольчик уведомлений', () => {
  it('показывает счётчик, список и ведёт на бронь', async () => {
    const notification = demoNotification();
    const requests: string[] = [];
    mockApi({
      notifications: [notification],
      unreadCount: 1,
      onRequest: (url, init) => {
        if (init?.method === 'POST' && url.includes('/me/notifications/read')) {
          requests.push(url);
        }
      },
    });

    renderBell();

    const bell = await screen.findByRole('button', { name: /непрочитанных: 1/ });
    await userEvent.click(bell);

    const dialog = await screen.findByRole('dialog', { name: 'Уведомления' });
    expect(within(dialog).getByText('Новая заявка')).toBeInTheDocument();
    expect(within(dialog).getByText(/Анна хочет забронировать/)).toBeInTheDocument();

    const item = within(dialog)
      .getByText(/Анна хочет забронировать/)
      .closest('button');
    if (!item) throw new Error('Уведомление не является кнопкой');
    await userEvent.click(item);

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        `/bookings/${notification.payload.bookingId}`,
      );
    });
    expect(requests).toHaveLength(1);
  });

  it('показывает пустое состояние', async () => {
    mockApi({ notifications: [] });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Уведомления' }));

    expect(await screen.findByText('Пока тихо')).toBeInTheDocument();
  });
});
