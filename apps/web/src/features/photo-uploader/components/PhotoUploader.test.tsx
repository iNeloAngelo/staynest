import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '../../../shared/ui';
import { demoPhoto } from '../../../test/api-mocks';
import { PhotoUploader } from './PhotoUploader';

const secondPhoto = {
  ...demoPhoto,
  id: '9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a',
  position: 1,
  isCover: false,
  urls: {
    thumb: '/media/listings/demo-2/thumb.webp',
    md: '/media/listings/demo-2/md.webp',
    lg: '/media/listings/demo-2/lg.webp',
  },
};

function renderUploader() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PhotoUploader listingId="listing-1" photos={[demoPhoto, secondPhoto]} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

describe('PhotoUploader', () => {
  it('офлайн блокирует порядок, обложку, удаление и выбор файлов', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    renderUploader();

    expect(screen.getByText(/Нет сети. Загрузка и изменение порядка/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Переместить раньше' })[1]).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Сделать обложкой' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Удалить фото' })[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Выбрать фото' })).toBeDisabled();
  });

  it('онлайн показывает обложку и доступные действия', () => {
    renderUploader();

    expect(screen.getByText('Обложка')).toBeInTheDocument();
    expect(screen.getByText('2 из 20')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Удалить фото' })[0]).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Сделать обложкой' })).toBeEnabled();
  });
});
