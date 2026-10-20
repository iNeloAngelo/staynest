import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { BookingDeposit } from '@staynest/shared';
import { demoBookingDetail } from '../../../test/api-mocks';
import { DepositPanel } from './DepositPanel';

function withQuery(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function bookingWith(deposit: BookingDeposit) {
  return { ...demoBookingDetail('confirmed'), deposit };
}

const baseDeposit: BookingDeposit = {
  status: 'created',
  amountMinor: 330_000,
  currency: 'RUB',
  dueAt: '2026-11-10T12:00:00.000Z',
  paidAt: null,
  refundedAt: null,
};

describe('DepositPanel', () => {
  it('гость видит сумму и кнопку оплаты', () => {
    render(withQuery(<DepositPanel booking={bookingWith(baseDeposit)} viewer="guest" />));

    expect(screen.getByRole('heading', { name: 'Депозит' })).toBeInTheDocument();
    expect(screen.getByText(/3\s?300/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Оплатить депозит' })).toBeEnabled();
  });

  it('хозяин видит долг гостя без кнопки оплаты', () => {
    render(withQuery(<DepositPanel booking={bookingWith(baseDeposit)} viewer="host" />));

    expect(screen.getByText(/Гость должен оплатить/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Оплатить депозит' })).not.toBeInTheDocument();
  });

  it('на отменённой брони не предлагает оплату', () => {
    const booking = {
      ...bookingWith({ ...baseDeposit, status: 'failed' }),
      status: 'cancelled_by_guest' as const,
    };
    render(withQuery(<DepositPanel booking={booking} viewer="guest" />));

    expect(screen.getByText('Бронь отменена, депозит не оплачен.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Оплатить депозит' })).not.toBeInTheDocument();
  });

  it('оплаченный и возвращённый депозит не предлагают оплату', () => {
    const { rerender } = render(
      withQuery(
        <DepositPanel
          booking={bookingWith({
            ...baseDeposit,
            status: 'succeeded',
            paidAt: '2026-11-02T10:00:00.000Z',
          })}
          viewer="guest"
        />,
      ),
    );
    expect(screen.getByText(/Депозит оплачен/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      withQuery(
        <DepositPanel
          booking={bookingWith({
            ...baseDeposit,
            status: 'refunded',
            paidAt: '2026-11-02T10:00:00.000Z',
            refundedAt: '2026-11-03T10:00:00.000Z',
          })}
          viewer="guest"
        />,
      ),
    );
    expect(screen.getByText(/Депозит возвращён/)).toBeInTheDocument();
  });
});
