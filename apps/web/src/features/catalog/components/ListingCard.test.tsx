import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { queryKeys } from '../../../shared/api';
import { ToastProvider } from '../../../shared/ui';
import { demoPublicListing } from '../../../test/api-mocks';
import { ListingCard } from './ListingCard';

function renderCard(stayPrice: typeof demoPublicListing.stayPrice) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Карточка содержит сердечко: без вошедшего пользователя оно не запрашивает id.
  queryClient.setQueryData(queryKeys.me, null);

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <ListingCard listing={{ ...demoPublicListing, stayPrice }} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('ListingCard', () => {
  it('показывает итог за выбранный период', () => {
    renderCard({
      checkIn: '2026-12-10',
      checkOut: '2026-12-14',
      nights: 4,
      nightlyTotalMinor: 550_000,
      cleaningFeeMinor: 50_000,
      totalMinor: 600_000,
      currency: 'RUB',
    });

    expect(screen.getByText(/за 4 ночи/)).toBeInTheDocument();
    expect(screen.queryByText(/\/ ночь/)).not.toBeInTheDocument();
  });

  it('без дат показывает цену за ночь', () => {
    renderCard(null);

    expect(screen.getByText(/\/ ночь/)).toBeInTheDocument();
  });
});
