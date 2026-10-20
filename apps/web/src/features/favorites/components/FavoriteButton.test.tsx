import type { UserDto } from '@staynest/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../shared/api';
import { ToastProvider } from '../../../shared/ui';
import { demoPublicListing, demoUser, mockApi } from '../../../test/api-mocks';
import { FavoriteButton } from './FavoriteButton';

function newClient(user: UserDto | null = demoUser) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.me, user);
  return queryClient;
}

function renderPair(user = demoUser) {
  const queryClient = newClient(user);

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <FavoriteButton listingId={demoPublicListing.id} />
          <FavoriteButton listingId={demoPublicListing.id} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );

  return { ...view, queryClient };
}

function LoginProbe() {
  const location = useLocation();
  const next = new URLSearchParams(location.search).get('next');

  return (
    <>
      <h1>Вход</h1>
      <p data-testid="login-next">{next}</p>
    </>
  );
}

function renderAnonymous() {
  const queryClient = newClient(null);

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/listings/abc']}>
          <Routes>
            <Route path="/login" element={<LoginProbe />} />
            <Route path="*" element={<FavoriteButton listingId={demoPublicListing.id} />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('FavoriteButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('синхронизирует сердечко между карточкой списка и карточкой дома', async () => {
    const fetchMock = mockApi({ user: demoUser, favoriteIds: [] });
    const user = userEvent.setup();
    renderPair();

    const initial = await screen.findAllByRole('button', { name: 'Добавить в избранное' });
    expect(initial).toHaveLength(2);

    await user.click(initial[0]!);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Убрать из избранного' })).toHaveLength(2);
    });

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith(`/me/favorites/${demoPublicListing.id}`) &&
          (init as RequestInit | undefined)?.method === 'PUT',
      ),
    ).toBe(true);

    const clear = screen.getAllByRole('button', { name: 'Убрать из избранного' });
    await user.click(clear[1]!);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Добавить в избранное' })).toHaveLength(2);
    });
  });

  it('переключает состояние до ответа сервера (оптимистично)', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = mockApi({ user: demoUser, favoriteIds: [] });
    const implementation = fetchMock.getMockImplementation() as
      ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined;

    fetchMock.mockImplementation(async (input, init) => {
      const method = (init as RequestInit | undefined)?.method;
      if (String(input).includes('/me/favorites/') && method === 'PUT') await gate;
      return implementation?.(input, init) ?? new Response(null, { status: 500 });
    });

    const user = userEvent.setup();
    renderPair();

    const add = await screen.findAllByRole('button', { name: 'Добавить в избранное' });
    await user.click(add[0]!);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Убрать из избранного' })).toHaveLength(2);
    });

    release();
  });

  it('откатывает сердечко и показывает тост при ошибке', async () => {
    mockApi({ user: demoUser, favoriteIds: [], favoriteStatus: 500 });
    const user = userEvent.setup();
    renderPair();

    await user.click((await screen.findAllByRole('button', { name: 'Добавить в избранное' }))[0]!);

    expect(
      await screen.findByText('Не удалось обновить избранное. Попробуйте ещё раз.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Добавить в избранное' })).toHaveLength(2);
    });
  });

  it('ведёт анонима на вход с возвратом на ту же страницу', async () => {
    const user = userEvent.setup();
    renderAnonymous();

    await user.click(screen.getByRole('button', { name: 'Добавить в избранное' }));

    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument();
    expect(screen.getByTestId('login-next')).toHaveTextContent('/listings/abc');
  });

  it('берёт начальное состояние из общего кэша id', async () => {
    mockApi({ user: demoUser, favoriteIds: [demoPublicListing.id] });
    renderPair();

    expect(await screen.findAllByRole('button', { name: 'Убрать из избранного' })).toHaveLength(2);
  });
});
