import type { ListingDto } from '@staynest/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../shared/ui';
import { completeListing, mockApi } from '../../../test/api-mocks';
import { ListingWizard } from './ListingWizard';
import { makeStoredDraft, readStoredDraft, writeStoredDraft } from '../model/draftStorage';
import { fromListing } from '../model/form';

function makeDraft(): ListingDto {
  return {
    ...completeListing,
    title: null,
    description: '',
    city: null,
    region: null,
    addressLine: null,
    maxGuests: null,
    bedrooms: null,
    beds: null,
    basePriceMinor: null,
  };
}

function renderWizard(listing: ListingDto = makeDraft()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <ListingWizard listing={listing} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function clickNext(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Далее' }));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ListingWizard', () => {
  it('ведёт по пяти шагам, проверяет поля и публикует объявление', async () => {
    const draft = makeDraft();
    mockApi({ listings: [draft] });
    const user = userEvent.setup();
    renderWizard(draft);

    expect(screen.getByText('Шаг 1 из 5')).toBeInTheDocument();

    await clickNext(user);
    expect(await screen.findByText('Проверьте поля')).toBeInTheDocument();
    expect(screen.getAllByText('Укажите название объявления.').length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText('Название'), 'Дом у озера');
    await user.type(
      screen.getByLabelText('Описание'),
      'Тихий дом у озера с террасой, камином и видом на сосновый лес.',
    );
    await clickNext(user);
    expect(await screen.findByRole('heading', { name: 'Расположение' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Шаг 2. Расположение' })).toHaveFocus();

    await user.type(screen.getByLabelText('Город'), 'Суздаль');
    await user.type(screen.getByLabelText('Адрес'), 'улица Лесная, 12');
    await clickNext(user);
    expect(await screen.findByRole('heading', { name: 'Вместимость' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Гостей'), '4');
    await user.type(screen.getByLabelText('Спален'), '2');
    await user.type(screen.getByLabelText('Кроватей'), '3');
    await clickNext(user);
    expect(await screen.findByRole('heading', { name: 'Фотографии' })).toBeInTheDocument();

    await clickNext(user);
    expect(await screen.findByRole('heading', { name: 'Цены' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Так объявление увидят гости' }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Цена за ночь, ₽'), '7500');
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));

    expect(await screen.findByText('Объявление опубликовано')).toBeInTheDocument();
  });

  it('сохраняет черновик автоматически после паузы', async () => {
    const draft = makeDraft();
    const bodies: Array<Record<string, unknown>> = [];
    mockApi({
      listings: [draft],
      onRequest: (url, init) => {
        if (init?.method === 'PATCH' && url.includes('/listings/') && init.body) {
          bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        }
      },
    });
    const user = userEvent.setup();
    renderWizard(draft);

    await user.type(screen.getByLabelText('Название'), 'Дом у озера');

    await waitFor(
      () => {
        expect(bodies.some((body) => body.title === 'Дом у озера')).toBe(true);
      },
      { timeout: 2500 },
    );
  });

  it('не публикует по Enter на последнем шаге', async () => {
    let publishCalls = 0;
    mockApi({
      listings: [completeListing],
      onRequest: (url, init) => {
        if (init?.method === 'POST' && url.endsWith('/publish')) publishCalls += 1;
      },
    });
    const user = userEvent.setup();
    renderWizard(completeListing);

    const price = await screen.findByLabelText('Цена за ночь, ₽');
    await user.click(price);
    await user.keyboard('{Enter}');
    expect(publishCalls).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    expect(publishCalls).toBe(1);
  });

  it('показывает несохранённые изменения у опубликованного объявления', async () => {
    const published = { ...completeListing, status: 'published' as const };
    mockApi({ listings: [published] });
    const user = userEvent.setup();
    renderWizard(published);

    await user.type(screen.getByLabelText('Название'), ' 2');

    expect(await screen.findByText('Есть несохранённые изменения')).toBeInTheDocument();
  });

  it('позволяет удалить недозаполненный черновик с первого шага', () => {
    mockApi({ listings: [makeDraft()] });
    renderWizard();

    expect(screen.getByRole('button', { name: 'Удалить черновик' })).toBeEnabled();
  });

  it('не теряет ввод, если вкладку закрыли до автосохранения', async () => {
    const draft = makeDraft();
    mockApi({ listings: [draft] });
    const user = userEvent.setup();
    const view = renderWizard(draft);

    await user.type(screen.getByLabelText('Название'), 'Дом');
    view.unmount();

    const stored = readStoredDraft(draft.id);
    expect(stored?.dirty).toBe(true);
    expect(stored?.form.title).toBe('Дом');
  });

  it('восстанавливает несохранённый черновик после закрытия вкладки', async () => {
    const draft = makeDraft();
    writeStoredDraft(
      makeStoredDraft({
        listingId: draft.id,
        form: { ...fromListing(draft), title: 'Восстановленный дом' },
        step: 0,
        maxReached: 2,
        baseUpdatedAt: draft.updatedAt,
        dirty: true,
      }),
    );
    mockApi({ listings: [draft] });
    renderWizard(draft);

    expect(await screen.findByText(/Восстановлены несохранённые изменения/)).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveValue('Восстановленный дом');
  });

  it('предлагает выбрать версию при конфликте с сервером', async () => {
    const draft = makeDraft();
    writeStoredDraft(
      makeStoredDraft({
        listingId: draft.id,
        form: { ...fromListing(draft), title: 'Мои правки' },
        step: 0,
        maxReached: 0,
        baseUpdatedAt: '2026-10-18T10:00:00.000Z',
        dirty: true,
      }),
    );
    mockApi({ listings: [draft] });
    const user = userEvent.setup();
    renderWizard({ ...draft, updatedAt: '2026-10-19T12:00:00.000Z' });

    expect(await screen.findByText('Черновик изменился в другом окне')).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Вернуть мои правки' }));

    expect(screen.getByLabelText('Название')).toHaveValue('Мои правки');
    expect(screen.getByText(/Восстановлены несохранённые изменения/)).toBeInTheDocument();
  });
});
