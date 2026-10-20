import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../shared/api';
import { ToastProvider } from '../../../shared/ui';
import { demoUser, mockApi } from '../../../test/api-mocks';
import { ProfileForm } from './ProfileForm';

function renderForm(user = demoUser) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.me, user);

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ProfileForm user={user} />
      </ToastProvider>
    </QueryClientProvider>,
  );

  return { ...view, queryClient };
}

describe('ProfileForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('сохраняет имя и телефон через PATCH /me', async () => {
    const fetchMock = mockApi({ user: demoUser });
    const user = userEvent.setup();
    const { queryClient } = renderForm();

    const name = screen.getByLabelText('Имя');
    await user.clear(name);
    await user.type(name, 'Анна Лесная');
    await user.type(screen.getByLabelText('Телефон'), '+7 900 000-00-00');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(screen.getByText('Профиль обновлён.')).toBeInTheDocument();
    });

    // Сервер вернул обновлённого пользователя — кэш `me` должен обновиться.
    expect(queryClient.getQueryData(queryKeys.me)).toMatchObject({
      displayName: 'Анна Лесная',
      phone: '+7 900 000-00-00',
    });

    const patch = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/me') && (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patch).toBeTruthy();
    expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({
      displayName: 'Анна Лесная',
      phone: '+7 900 000-00-00',
    });
  });

  it('очищает телефон, когда поле пустое', async () => {
    const withPhone = { ...demoUser, phone: '+7 900 111-11-11' };
    const fetchMock = mockApi({ user: withPhone });
    const user = userEvent.setup();
    renderForm(withPhone);

    await user.clear(screen.getByLabelText('Телефон'));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).endsWith('/me') && (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toMatchObject({ phone: null });
    });
  });

  it('показывает ошибку и не обновляет кэш при сбое PATCH', async () => {
    mockApi({ user: demoUser, profileStatus: 500 });
    const user = userEvent.setup();
    const { queryClient } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(
      await screen.findByText('Не удалось сохранить профиль. Попробуйте ещё раз.'),
    ).toBeInTheDocument();
    expect(queryClient.getQueryData(queryKeys.me)).toMatchObject({
      displayName: demoUser.displayName,
    });
  });
});
