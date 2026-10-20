import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeProvider } from '../features/mode-switch';
import { addDays } from '@staynest/shared';
import { formatLongDate, todayLocalIso } from '../shared/lib/dates';
import { ToastProvider } from '../shared/ui';
import {
  completeListing,
  demoBooking,
  demoBookingDetail,
  demoListing,
  demoPublicListing,
  demoUser,
  mockApi,
} from '../test/api-mocks';
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

function findDayButton(date: string, status = 'доступно'): HTMLElement {
  const label = formatLongDate(date, 'ru');
  const button = screen
    .getAllByRole('button')
    .find(
      (element) =>
        (element.getAttribute('aria-label') ?? '').includes(label) &&
        (element.getAttribute('aria-label') ?? '').includes(status),
    );

  if (!button) {
    const labels = screen
      .getAllByRole('button')
      .map((element) => element.getAttribute('aria-label') ?? element.textContent)
      .filter(Boolean)
      .join(' | ');
    throw new Error(`Не найдена кнопка дня ${date} со статусом ${status}. Кнопки: ${labels}`);
  }
  return button;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('App', () => {
  it('показывает главную и переключает язык', async () => {
    mockApi();
    renderApp(['/']);

    expect(
      await screen.findByRole('heading', { name: /дом, который ждёт вас/i, level: 1 }),
    ).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'Войти' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Переключить язык/ }));

    expect(
      await screen.findByRole('heading', { name: /a home that waits for you/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('показывает каталог и передаёт фильтры из URL в API', async () => {
    const requests: string[] = [];
    mockApi({
      onRequest: (url) => {
        if (url.includes('/listings?')) requests.push(url);
      },
    });

    renderApp(['/?city=Суздаль&guests=2']);

    expect(
      await screen.findByRole('heading', { name: /дом у озера/i, level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Город')).toHaveValue('Суздаль');

    const catalogRequest = decodeURIComponent(requests.at(-1) ?? '');
    expect(catalogRequest).toContain('city=Суздаль');
    expect(catalogRequest).toContain('guests=2');
  });

  it('передаёт в API все фильтры из ссылки', async () => {
    const requests: string[] = [];
    mockApi({
      onRequest: (url) => {
        if (url.includes('/listings?')) requests.push(url);
      },
    });

    renderApp([
      '/?q=%D0%BE%D0%B7%D0%B5%D1%80%D0%BE&priceMin=500000&priceMax=900000&bedroomsMin=2&type=house%2Cvilla&amenities=1&sort=price_asc',
    ]);

    await screen.findByRole('heading', { name: /дом у озера/i, level: 3 });
    await waitFor(() => {
      const request = decodeURIComponent(requests.at(-1) ?? '');
      expect(request).toContain('q=озеро');
      expect(request).toContain('priceMin=500000');
      expect(request).toContain('priceMax=900000');
      expect(request).toContain('bedroomsMin=2');
      expect(request).toContain('type=house,villa');
      expect(request).toContain('amenities=1');
      expect(request).toContain('sort=price_asc');
    });
  });

  it('показывает цену фильтра в рублях и отправляет копейки', async () => {
    const requests: string[] = [];
    mockApi({
      onRequest: (url) => {
        if (url.includes('/listings?')) requests.push(url);
      },
    });
    const user = userEvent.setup();
    renderApp(['/?priceMax=750000']);

    const max = await screen.findByLabelText('До');
    expect(max).toHaveValue('7500');

    await user.clear(max);
    await user.type(max, '8000');

    await waitFor(() => {
      expect(decodeURIComponent(requests.at(-1) ?? '')).toContain('priceMax=800000');
    });
  });

  it('меняет сортировку и запрашивает выдачу заново', async () => {
    const requests: string[] = [];
    mockApi({
      onRequest: (url) => {
        if (url.includes('/listings?')) requests.push(url);
      },
    });
    const user = userEvent.setup();
    renderApp(['/?city=%D0%A1%D1%83%D0%B7%D0%B4%D0%B0%D0%BB%D1%8C']);

    const sort = await screen.findByLabelText('Сортировка');
    await user.selectOptions(sort, 'price_desc');

    await waitFor(() => {
      expect(decodeURIComponent(requests.at(-1) ?? '')).toContain('sort=price_desc');
    });
  });

  it('запрашивает подсказки города после двух символов', async () => {
    const requests: string[] = [];
    mockApi({
      onRequest: (url) => {
        requests.push(url);
      },
    });
    const user = userEvent.setup();
    renderApp(['/']);

    const city = await screen.findByLabelText('Город');
    await user.type(city, 'Су');

    await waitFor(() => {
      expect(requests.some((url) => url.includes('/cities?'))).toBe(true);
    });
  });

  it('открывает карточку дома без точного адреса', async () => {
    mockApi();
    renderApp([`/listings/${demoPublicListing.id}`]);

    expect(
      await screen.findByRole('heading', { name: 'Дом у озера', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Wi-Fi')).toBeInTheDocument();
    expect(screen.getByText('Сауна')).toBeInTheDocument();
    expect(screen.getAllByText(/за ночь/).length).toBeGreaterThan(0);
    expect(screen.getByText('Курить нельзя. С животными — по договорённости.')).toBeInTheDocument();
    expect(screen.queryByText(/Частный адрес/)).not.toBeInTheDocument();
  });

  it('показывает пустую выдачу и сбрасывает фильтры', async () => {
    mockApi({ catalogListings: [] });
    const user = userEvent.setup();
    renderApp(['/?city=Москва']);

    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Сбросить фильтры' })[0]!);

    expect(screen.getByLabelText('Город')).toHaveValue('');
  });

  it('открывает фильтры в нижней панели на мобильном', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp(['/']);

    await screen.findByRole('heading', { name: /дом, который ждёт вас/i, level: 1 });
    await user.click(screen.getAllByRole('button', { name: 'Фильтры' })[0]!);

    expect(await screen.findByRole('dialog', { name: 'Фильтры' })).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: /Переключить язык/ }));

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
      listings: [completeListing],
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
    renderApp([`/host/listings/${completeListing.id}`]);

    const publish = await screen.findByRole('button', { name: 'Опубликовать' });
    await user.click(publish);

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
    mockApi({ user: demoUser, listings: [completeListing] });
    renderApp([`/host/listings/${completeListing.id}`]);

    expect((await screen.findAllByText(/Нет сети/)).length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: 'Сохранить' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeDisabled();
  });

  it('показывает расчёт стоимости из ответа сервера', async () => {
    const quoteRequests: string[] = [];
    mockApi({
      onRequest: (url) => {
        if (url.includes('/quote?')) quoteRequests.push(decodeURIComponent(url));
      },
    });
    const user = userEvent.setup();
    renderApp([`/listings/${demoPublicListing.id}`]);

    await screen.findByRole('heading', { name: 'Дом у озера', level: 1 });
    await screen.findByRole('heading', { name: 'Даты и стоимость' });
    const checkIn = addDays(todayLocalIso(), 1);
    const checkOut = addDays(todayLocalIso(), 3);

    await user.click(findDayButton(checkIn));
    await user.click(findDayButton(checkOut));

    expect(await screen.findByText('Итого')).toBeInTheDocument();
    expect(screen.getAllByText(/16\s?500/).length).toBeGreaterThan(0);

    await waitFor(() => {
      const request = quoteRequests.at(-1) ?? '';
      expect(request).toContain(`checkIn=${checkIn}`);
      expect(request).toContain(`checkOut=${checkOut}`);
      expect(request).toContain('guests=1');
    });
  });

  it('разрешает выезд в занятую ночь следующего гостя', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp([`/listings/${demoPublicListing.id}`]);

    await screen.findByRole('heading', { name: 'Дом у озера', level: 1 });
    await screen.findByRole('heading', { name: 'Даты и стоимость' });
    const checkIn = addDays(todayLocalIso(), 3);
    const busyCheckout = addDays(todayLocalIso(), 5);

    await user.click(findDayButton(checkIn));
    await user.click(findDayButton(busyCheckout, 'занято'));

    expect(await screen.findByText('Итого')).toBeInTheDocument();
    expect(
      screen.getAllByText(new RegExp(formatLongDate(busyCheckout, 'ru'))).length,
    ).toBeGreaterThan(0);
  });

  it('не даёт перепрыгнуть занятую ночь и переносит начало', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp([`/listings/${demoPublicListing.id}`]);

    await screen.findByRole('heading', { name: 'Дом у озера', level: 1 });
    await screen.findByRole('heading', { name: 'Даты и стоимость' });
    await user.click(findDayButton(addDays(todayLocalIso(), 4)));
    await user.click(findDayButton(addDays(todayLocalIso(), 7)));

    expect(await screen.findByText(/Через занятые ночи выбрать нельзя/)).toBeInTheDocument();
    expect(screen.queryByText('Итого')).not.toBeInTheDocument();
  });

  it('показывает загрузку, а не ошибку, пока календарь хозяина грузится', async () => {
    mockApi({
      user: demoUser,
      listings: [{ ...completeListing, status: 'published' }],
      pendingHostCalendar: true,
    });
    renderApp(['/host/calendar']);

    expect((await screen.findAllByText('Загружаем…')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Не удалось загрузить календарь')).not.toBeInTheDocument();
  });

  it('блокирует выбранные даты в календаре хозяина', async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    mockApi({
      user: demoUser,
      listings: [{ ...completeListing, status: 'published' }],
      onRequest: (url, init) => {
        if (init?.method === 'POST' && url.includes('/blocks')) {
          requests.push({ url, body: JSON.parse(String(init.body)) as unknown });
        }
      },
    });
    const user = userEvent.setup();
    renderApp(['/host/calendar']);

    expect(
      await screen.findByRole('heading', { name: 'Календарь и цены', level: 1 }),
    ).toBeInTheDocument();
    await screen.findByText('Заявка');

    const checkIn = addDays(todayLocalIso(), 1);
    const checkOut = addDays(todayLocalIso(), 3);
    await user.click(findDayButton(checkIn));
    await user.click(findDayButton(checkOut));

    expect(await screen.findByRole('dialog', { name: 'Заблокировать даты' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Причина'), 'Ремонт');
    await user.click(screen.getByRole('button', { name: 'Заблокировать' }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.body).toEqual({
      dateFrom: checkIn,
      dateTo: addDays(checkOut, -1),
      reason: 'Ремонт',
    });
    expect(await screen.findByText('Даты заблокированы')).toBeInTheDocument();
  });

  it('отправляет заявку с ключом идемпотентности и открывает экран результата', async () => {
    const requests: Array<{ key: string | null; body: Record<string, unknown> }> = [];
    const detail = demoBookingDetail('pending');
    mockApi({
      user: demoUser,
      bookingDetail: detail,
      onRequest: (url, init) => {
        if (url.endsWith('/bookings') && init?.method === 'POST') {
          requests.push({
            key: new Headers(init.headers).get('idempotency-key'),
            body: JSON.parse(String(init.body)) as Record<string, unknown>,
          });
        }
      },
    });
    const user = userEvent.setup();
    renderApp([`/listings/${demoPublicListing.id}`]);

    await screen.findByRole('heading', { name: 'Даты и стоимость' });
    const checkIn = addDays(todayLocalIso(), 1);
    const checkOut = addDays(todayLocalIso(), 3);
    await user.click(findDayButton(checkIn));
    await user.click(findDayButton(checkOut));
    await screen.findByText('Итого');

    await user.type(screen.getByLabelText('Сообщение хозяину'), 'Приедем вечером');
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));

    expect(await screen.findByRole('heading', { name: 'Заявка отправлена' })).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.key).toMatch(/[0-9a-f-]{20,}/);
    expect(requests[0]?.body).toMatchObject({
      listingId: demoPublicListing.id,
      checkIn,
      checkOut,
      guestsCount: 1,
      guestMessage: 'Приедем вечером',
    });
  });

  it('объясняет конфликт дат и перезапрашивает календарь', async () => {
    let calendarRequests = 0;
    mockApi({
      user: demoUser,
      bookingCreateStatus: 409,
      bookingCreateBody: {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        code: 'booking_dates_unavailable',
      },
      onRequest: (url) => {
        if (url.includes('/calendar?')) calendarRequests += 1;
      },
    });
    const user = userEvent.setup();
    renderApp([`/listings/${demoPublicListing.id}`]);

    await screen.findByRole('heading', { name: 'Даты и стоимость' });
    const checkIn = addDays(todayLocalIso(), 1);
    const checkOut = addDays(todayLocalIso(), 3);
    await user.click(findDayButton(checkIn));
    await user.click(findDayButton(checkOut));
    await screen.findByText('Итого');
    const before = calendarRequests;

    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));

    expect(await screen.findByText(/Эти даты только что заняли/)).toBeInTheDocument();
    await waitFor(() => expect(calendarRequests).toBeGreaterThan(before));
    expect(screen.getAllByRole('button', { name: 'Сбросить даты' }).length).toBeGreaterThan(0);
  });

  it('показывает поездки по вкладкам и отменяет заявку', async () => {
    const pending = { ...demoBooking('pending'), id: '11111111-1111-4111-8111-111111111111' };
    const confirmed = { ...demoBooking('confirmed'), id: '22222222-2222-4222-8222-222222222222' };
    const declined = { ...demoBooking('declined'), id: '33333333-3333-4333-8333-333333333333' };
    mockApi({ user: demoUser, bookings: [pending, confirmed, declined] });
    const user = userEvent.setup();
    renderApp(['/trips']);

    expect(await screen.findByRole('heading', { name: 'Мои поездки' })).toBeInTheDocument();
    expect(await screen.findByText('Ожидает ответа')).toBeInTheDocument();
    expect(screen.getByText('Подтверждено')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Отменённые/ }));
    expect(await screen.findByText('Отклонено')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Предстоящие/ }));
    await user.click(screen.getAllByRole('button', { name: 'Отменить заявку' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Отменить заявку?' });
    await user.click(within(dialog).getByRole('button', { name: 'Отменить заявку' }));

    expect(await screen.findByText('Бронь отменена')).toBeInTheDocument();
  });

  it('подтверждает входящую заявку хозяина', async () => {
    mockApi({ user: demoUser, bookings: [demoBooking('pending')] });
    const user = userEvent.setup();
    renderApp(['/host/requests']);

    expect(await screen.findByRole('heading', { name: 'Входящие заявки' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Подтвердить' }));

    const dialog = await screen.findByRole('dialog', { name: 'Подтвердить заявку?' });
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить' }));

    expect(await screen.findByText('Заявка подтверждена')).toBeInTheDocument();
  });

  it('показывает статус, таймлайн и контакты подтверждённой брони', async () => {
    const confirmed = demoBookingDetail('confirmed');
    mockApi({ user: demoUser, bookingDetail: confirmed });
    renderApp([`/bookings/${confirmed.id}`]);

    expect(await screen.findByRole('heading', { name: 'Дом у озера' })).toBeInTheDocument();
    expect(screen.getAllByText('Подтверждено').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Контакты' })).toBeInTheDocument();
    expect(screen.getByText('улица Лесная, 12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+7 900 000-00-22' })).toHaveAttribute(
      'href',
      'tel:+79000000022',
    );
    expect(screen.getByRole('heading', { name: 'История брони' })).toBeInTheDocument();
  });

  it('отклоняет заявку с комментарием', async () => {
    const comments: unknown[] = [];
    mockApi({
      user: demoUser,
      bookings: [demoBooking('pending')],
      onRequest: (url, init) => {
        if (url.endsWith('/decline') && init?.body) {
          comments.push(JSON.parse(String(init.body)));
        }
      },
    });
    const user = userEvent.setup();
    renderApp(['/host/requests']);

    await user.click(await screen.findByRole('button', { name: 'Отклонить' }));
    const dialog = await screen.findByRole('dialog', { name: 'Отклонить заявку' });
    await user.type(within(dialog).getByLabelText('Комментарий для гостя'), 'Эти даты уже заняты');
    await user.click(within(dialog).getByRole('button', { name: 'Отклонить' }));

    expect(await screen.findByText('Заявка отклонена')).toBeInTheDocument();
    expect(comments[0]).toEqual({ comment: 'Эти даты уже заняты' });
  });

  it('требует причину при отмене подтверждённой брони хозяином', async () => {
    mockApi({ user: demoUser, bookings: [demoBooking('confirmed')] });
    const user = userEvent.setup();
    renderApp(['/host/requests']);

    await user.click(await screen.findByRole('tab', { name: /Подтверждённые/ }));
    await user.click(await screen.findByRole('button', { name: 'Отменить бронь' }));
    const dialog = await screen.findByRole('dialog', { name: 'Отменить подтверждённую бронь' });
    await user.click(within(dialog).getByRole('button', { name: 'Отменить бронь' }));

    expect(await within(dialog).findByText('Укажите причину отмены.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Причина отмены'), 'Заболел');
    await user.click(within(dialog).getByRole('button', { name: 'Отменить бронь' }));

    expect(await screen.findByText('Бронь отменена, гость увидит причину')).toBeInTheDocument();
  });

  it('объясняет офлайн и блокирует отправку заявки', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    mockApi({ user: demoUser });
    const user = userEvent.setup();
    renderApp([`/listings/${demoPublicListing.id}`]);

    await screen.findByRole('heading', { name: 'Даты и стоимость' });
    const checkIn = addDays(todayLocalIso(), 1);
    const checkOut = addDays(todayLocalIso(), 3);
    await user.click(findDayButton(checkIn));
    await user.click(findDayButton(checkOut));
    await screen.findByText('Итого');

    expect(screen.getByText(/Нет сети\. Отправить заявку/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отправить заявку' })).toBeDisabled();
  });
});
