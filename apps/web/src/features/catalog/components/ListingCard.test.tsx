import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { demoPublicListing } from '../../../test/api-mocks';
import { ListingCard } from './ListingCard';

function renderCard(stayPrice: typeof demoPublicListing.stayPrice) {
  return render(
    <MemoryRouter>
      <ListingCard listing={{ ...demoPublicListing, stayPrice }} />
    </MemoryRouter>,
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
