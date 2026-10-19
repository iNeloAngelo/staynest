import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok', db: 'up', version: '0.1.0', uptime: 1 }),
      }),
    );
  });

  it('показывает заголовок и состояние API', async () => {
    renderApp();

    expect(
      screen.getByRole('heading', { name: /дом, который ждёт вас/i, level: 1 }),
    ).toBeInTheDocument();

    expect(await screen.findByText(/статус: ok, база: up/i)).toBeInTheDocument();
  });
});
