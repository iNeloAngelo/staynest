import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationPanel } from './NotificationPanel';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('панель уведомлений', () => {
  it('показывает пустое состояние', () => {
    render(
      <NotificationPanel
        notifications={[]}
        isLoading={false}
        isError={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByText('Пока тихо')).toBeInTheDocument();
  });

  it('отличает офлайн от ошибки сервера', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    render(
      <NotificationPanel
        notifications={[]}
        isLoading={false}
        isError
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByText('Нет сети')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Попробовать ещё раз' })).toBeNull();
  });
});
