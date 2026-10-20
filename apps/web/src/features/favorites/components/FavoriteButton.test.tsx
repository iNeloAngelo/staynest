import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../shared/api';
import { ToastProvider } from '../../../shared/ui';
import { demoPublicListing, demoUser, mockApi } from '../../../test/api-mocks';
import { FavoriteButton } from './FavoriteButton';

function renderPair() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.me, demoUser);

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

  it('берёт начальное состояние из общего кэша id', async () => {
    mockApi({ user: demoUser, favoriteIds: [demoPublicListing.id] });
    renderPair();

    expect(await screen.findAllByRole('button', { name: 'Убрать из избранного' })).toHaveLength(2);
  });
});
