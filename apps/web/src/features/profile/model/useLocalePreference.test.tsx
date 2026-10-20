import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../shared/api';
import { ToastProvider } from '../../../shared/ui';
import { demoUser, mockApi } from '../../../test/api-mocks';
import { useLocalePreference } from './useLocalePreference';

function setup(status = 200) {
  const fetchMock = mockApi({ user: demoUser, profileStatus: status });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.me, demoUser);

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  }

  return { fetchMock, ...renderHook(() => useLocalePreference(), { wrapper }) };
}

describe('useLocalePreference', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('применяет язык сразу и сохраняет его через PATCH /me', async () => {
    const { fetchMock, result } = setup();

    await act(async () => {
      await result.current.changeLocale('en');
    });

    expect(result.current.locale).toBe('en');

    const patch = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/me') && (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patch).toBeTruthy();
    expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({ locale: 'en' });
  });

  it('откатывает язык, если сервер не сохранил настройку', async () => {
    const { result } = setup(500);

    await act(async () => {
      await result.current.changeLocale('en');
    });

    await waitFor(() => {
      expect(result.current.locale).toBe('ru');
    });
    expect(
      await screen.findByText('Не удалось сохранить профиль. Попробуйте ещё раз.'),
    ).toBeInTheDocument();
  });
});
