import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../shared/ui';
import { ApiError } from '../../../shared/api';
import { usePhotoUploads } from './usePhotoUploads';

const mocks = vi.hoisted(() => ({
  uploadPhoto: vi.fn(),
  preparePhoto: vi.fn(),
}));

vi.mock('../api/photos', () => ({
  uploadPhoto: (...args: unknown[]) => mocks.uploadPhoto(...args),
}));

vi.mock('./compress', () => ({
  preparePhoto: (...args: unknown[]) => mocks.preparePhoto(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

const createObjectURL = vi.fn(() => 'blob:preview');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  mocks.uploadPhoto.mockReset();
  mocks.preparePhoto.mockReset();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePhotoUploads', () => {
  it('не принимает файлы сверх лимита объявления', () => {
    const { result } = renderHook(() => usePhotoUploads('listing-1', 20), { wrapper });
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

    act(() => result.current.addFiles([file]));

    expect(result.current.items).toHaveLength(0);
    expect(mocks.uploadPhoto).not.toHaveBeenCalled();
  });

  it('сжимает и загружает файл, показывая готовность', async () => {
    const prepared = new File(['small'], 'photo.webp', { type: 'image/webp' });
    mocks.preparePhoto.mockResolvedValue(prepared);
    mocks.uploadPhoto.mockResolvedValue([]);

    const { result } = renderHook(() => usePhotoUploads('listing-1', 0), { wrapper });
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

    act(() => result.current.addFiles([file]));

    await waitFor(() => expect(mocks.uploadPhoto).toHaveBeenCalledTimes(1));
    expect(mocks.uploadPhoto).toHaveBeenCalledWith('listing-1', prepared, expect.any(Function));
    expect(result.current.items[0]?.status).toBe('done');
    expect(result.current.items[0]?.progress).toBe(100);
  });

  it('показывает ошибку сервера и позволяет повторить', async () => {
    mocks.preparePhoto.mockResolvedValue(new File(['x'], 'photo.webp', { type: 'image/webp' }));
    mocks.uploadPhoto.mockRejectedValue(new ApiError(413, 'photo_too_large', 'too large'));

    const { result } = renderHook(() => usePhotoUploads('listing-1', 0), { wrapper });

    act(() => result.current.addFiles([new File(['x'], 'photo.jpg', { type: 'image/jpeg' })]));

    await waitFor(() => expect(result.current.items[0]?.status).toBe('error'));
    expect(result.current.items[0]?.errorKey).toBe('photos.errors.tooLarge');

    const failedId = result.current.items[0]?.id ?? '';
    mocks.uploadPhoto.mockResolvedValue([]);
    act(() => result.current.retry(failedId));

    await waitFor(() => expect(mocks.uploadPhoto).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.items[0]?.status).toBe('done'));
  });
});
