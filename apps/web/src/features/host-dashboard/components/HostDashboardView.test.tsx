import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../shared/ui';
import { demoDashboard, demoUser, mockApi } from '../../../test/api-mocks';
import { HostDashboardView } from './HostDashboardView';

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <HostDashboardView />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('HostDashboardView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('показывает цифры сводки и ближайший заезд', async () => {
    mockApi({ user: demoUser, dashboard: demoDashboard() });
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Сводка', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Занятость 30 дней')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText(/6 из 30 ночей/)).toBeInTheDocument();
    expect(screen.getAllByText('Дом у озера').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
  });

  it('строит график дохода и дублирует значения для скринридера', async () => {
    mockApi({ user: demoUser, dashboard: demoDashboard() });
    renderDashboard();

    const chart = await screen.findByRole('img', { name: 'Доход по месяцам' });
    expect(within(chart).getAllByText(/[а-яё]{3}/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2\s?500/).length).toBeGreaterThan(0);
  });

  it('показывает ошибку с повтором, если API недоступен', async () => {
    mockApi({ user: demoUser, dashboard: demoDashboard() });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 500 })));
    renderDashboard();

    expect(
      await screen.findByText('Не удалось загрузить сводку', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Попробовать ещё раз' })).toBeInTheDocument();
  });
});
