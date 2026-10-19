import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_FILTERS } from '../model/filters';
import { CatalogSearchBar } from './CatalogSearchBar';

function fillDates(checkIn: string, checkOut?: string) {
  fireEvent.change(screen.getByLabelText('Заезд'), { target: { value: checkIn } });
  if (checkOut) fireEvent.change(screen.getByLabelText('Выезд'), { target: { value: checkOut } });
}

function renderBar(onChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <CatalogSearchBar filters={EMPTY_FILTERS} onChange={onChange} />
    </QueryClientProvider>,
  );

  return onChange;
}

describe('CatalogSearchBar', () => {
  it('не применяет одну дату без второй', async () => {
    const user = userEvent.setup();
    const onChange = renderBar();

    fillDates('2026-12-10');
    await user.click(screen.getByRole('button', { name: 'Найти' }));

    expect(screen.getByText('Выберите обе даты: заезд и выезд.')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('применяет полный диапазон дат', async () => {
    const user = userEvent.setup();
    const onChange = renderBar();

    fillDates('2026-12-10', '2026-12-14');
    await user.click(screen.getByRole('button', { name: 'Найти' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ checkIn: '2026-12-10', checkOut: '2026-12-14' }),
    );
  });

  it('не применяет слишком длинный диапазон', async () => {
    const user = userEvent.setup();
    const onChange = renderBar();

    fillDates('2026-01-01', '2028-01-01');
    await user.click(screen.getByRole('button', { name: 'Найти' }));

    expect(screen.getByText(/не больше 365 ночей/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
