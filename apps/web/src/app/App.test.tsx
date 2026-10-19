import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeProvider } from '../features/mode-switch';
import { ToastProvider } from '../shared/ui';
import { demoListing, demoUser, mockApi } from '../test/api-mocks';
import { App } from './App';

function renderApp(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ModeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </ModeProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('показывает главную и переключает язык', async () => {
    mockApi();
    renderApp(['/']);

    expect(
      await screen.findByRole('heading', { name: /дом, который ждёт вас/i, level: 1 }),
    ).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'Войти' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Переключить язык' }));

    expect(
      await screen.findByRole('heading', { name: /a home that waits for you/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('переключает режим и нижнюю навигацию', async () => {
    mockApi();
    renderApp(['/']);

    await screen.findByRole('heading', { name: /дом, который ждёт вас/i, level: 1 });

    await userEvent.click(screen.getAllByRole('button', { name: 'Я сдаю' })[0]!);

    expect(
      await screen.findByRole('heading', { name: /ваш дом может больше/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Объявления' }).length).toBeGreaterThan(0);
  });

  it('редиректит гостя с защищённого маршрута на вход', async () => {
    mockApi();
    renderApp(['/profile']);

    expect(
      await screen.findByRole('heading', { name: 'С возвращением', level: 1 }),
    ).toBeInTheDocument();
  });

  it('показывает профиль вошедшего пользователя', async () => {
    mockApi({ user: demoUser });
    renderApp(['/profile']);

    expect(await screen.findByRole('heading', { name: 'Анна', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('anna@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Подтверждён')).toBeInTheDocument();
  });

  it('выполняет вход и возвращает на главную', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp(['/login']);

    await user.type(await screen.findByLabelText('Email'), 'anna@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'Forest-Lake-2026');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(
      await screen.findByRole('heading', { name: /дом, который ждёт вас/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('показывает экран проверки почты после регистрации', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp(['/register']);

    await user.type(await screen.findByLabelText('Имя'), 'Анна');
    await user.type(screen.getByLabelText('Email'), 'anna@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'Forest-Lake-2026');
    await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(
      await screen.findByRole('heading', { name: 'Проверьте почту', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/anna@example\.com/)).toBeInTheDocument();
  });

  it('отправляет локаль, выбранную на странице регистрации', async () => {
    let body: { locale?: string } | null = null;
    mockApi({
      onRequest: (url, init) => {
        if (url.endsWith('/auth/register') && init?.body) {
          body = JSON.parse(String(init.body)) as { locale?: string };
        }
      },
    });
    const user = userEvent.setup();
    renderApp(['/register']);

    await screen.findByRole('heading', { name: 'Создайте аккаунт', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Переключить язык' }));

    await user.type(await screen.findByLabelText('Name'), 'Anna');
    await user.type(screen.getByLabelText('Email'), 'anna@example.com');
    await user.type(screen.getByLabelText('Password'), 'Forest-Lake-2026');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByRole('heading', { name: 'Check your email', level: 2 });
    expect(body).toMatchObject({ locale: 'en' });
  });

  it('показывает недействительную ссылку подтверждения', async () => {
    mockApi();
    renderApp(['/verify-email']);

    expect(
      await screen.findByRole('heading', { name: 'Ссылка недействительна', level: 2 }),
    ).toBeInTheDocument();
  });

  it('подтверждает email по ссылке с токеном', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp([`/verify-email?token=${'a'.repeat(32)}`]);

    await user.type(await screen.findByLabelText('Пароль'), 'Forest-Lake-2026');
    await user.click(screen.getByRole('button', { name: 'Подтвердить email' }));

    expect(
      await screen.findByRole('heading', { name: 'Email подтверждён', level: 2 }),
    ).toBeInTheDocument();
  });

  it('запрашивает сброс пароля и не раскрывает существование email', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp(['/forgot-password']);

    await user.type(await screen.findByLabelText('Email'), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }));

    expect(
      await screen.findByRole('heading', { name: 'Проверьте почту', level: 2 }),
    ).toBeInTheDocument();
  });

  it('задаёт новый пароль по ссылке и завершает старые сессии', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp([`/reset-password?token=${'b'.repeat(32)}`]);

    await user.type(await screen.findByLabelText('Новый пароль'), 'Forest-Lake-2026');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(
      await screen.findByRole('heading', { name: 'Пароль изменён', level: 2 }),
    ).toBeInTheDocument();
  });

  it('показывает ошибку входа с сервера', async () => {
    mockApi({
      user: null,
      loginStatus: 401,
      loginBody: { code: 'invalid_credentials', detail: 'Неверный email или пароль.' },
    });
    const user = userEvent.setup();
    renderApp(['/login']);

    await user.type(await screen.findByLabelText('Email'), 'anna@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный email или пароль.');
  });

  it('показывает статусы моих объявлений', async () => {
    mockApi({
      user: demoUser,
      listings: [
        {
          ...demoListing,
          status: 'published',
          title: 'Дом у озера',
          city: 'Суздаль',
          basePriceMinor: 750_000,
        },
      ],
    });
    renderApp(['/host/listings']);

    expect(await screen.findByText('Дом у озера')).toBeInTheDocument();
    expect(screen.getByText('Опубликовано')).toBeInTheDocument();
    expect(screen.getByText(/Суздаль/)).toBeInTheDocument();
  });

  it('создаёт черновик и открывает редактор', async () => {
    mockApi({ user: demoUser, listings: [] });
    const user = userEvent.setup();
    renderApp(['/host/listings']);

    expect(await screen.findByText('Пока нет объявлений')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Создать объявление' })[0]!);

    expect(
      await screen.findByRole('heading', { name: 'Новое объявление', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toBeInTheDocument();
  });

  it('показывает ошибки публикации из ответа сервера', async () => {
    mockApi({
      user: demoUser,
      listings: [{ ...demoListing, title: 'Дом у озера' }],
      publishStatus: 422,
      publishBody: {
        code: 'listing_incomplete',
        detail: 'Заполните обязательные поля.',
        errors: [
          { field: 'photos', code: 'photos_too_few', message: 'Добавьте минимум 3 фотографии.' },
        ],
      },
    });
    const user = userEvent.setup();
    renderApp([`/host/listings/${demoListing.id}`]);

    await screen.findByLabelText('Название');
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));

    expect(await screen.findByText('Пока нельзя опубликовать')).toBeInTheDocument();
    expect(screen.getByText('Добавьте минимум 3 фотографии.')).toBeInTheDocument();
  });

  it('сохраняет форму и отправляет PATCH с введёнными полями', async () => {
    let body: Record<string, unknown> | null = null;
    mockApi({
      user: demoUser,
      listings: [{ ...demoListing, title: 'Дом у озера' }],
      onRequest: (url, init) => {
        if (init?.method === 'PATCH' && url.includes('/listings/') && init.body) {
          body = JSON.parse(String(init.body)) as Record<string, unknown>;
        }
      },
    });
    const user = userEvent.setup();
    renderApp([`/host/listings/${demoListing.id}`]);

    const title = await screen.findByLabelText('Название');
    await user.clear(title);
    await user.type(title, 'Дом у озера 2');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    expect(body).toMatchObject({ title: 'Дом у озера 2' });
  });

  it('блокирует сохранение без сети и показывает объяснение', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    mockApi({ user: demoUser, listings: [{ ...demoListing, title: 'Дом у озера' }] });
    renderApp([`/host/listings/${demoListing.id}`]);

    expect(await screen.findByText(/Нет сети/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeDisabled();
  });
});
