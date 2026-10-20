import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPrivateClientData } from './cleanup';

function cacheStorage(names: string[]) {
  const deleted: string[] = [];
  const storage = {
    keys: vi.fn().mockResolvedValue(names),
    delete: vi.fn(async (name: string) => {
      deleted.push(name);
      return true;
    }),
  };

  return { storage, deleted };
}

describe('очистка данных при выходе', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('удаляет runtime-кэши, черновики и IndexedDB, но сохраняет precache', async () => {
    const { storage, deleted } = cacheStorage([
      'workbox-precache-v2-http://localhost/',
      'staynest-me',
      'staynest-catalog',
      'staynest-media',
    ]);
    vi.stubGlobal('caches', storage);

    const deleteDatabase = vi.fn(() => {
      const request: { onsuccess: (() => void) | null; onerror: null; onblocked: null } = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    });
    vi.stubGlobal('indexedDB', {
      databases: vi.fn().mockResolvedValue([{ name: 'staynest' }]),
      deleteDatabase,
    });

    window.localStorage.setItem('staynest:listing-draft:abc', '{"title":"Дом"}');
    window.localStorage.setItem('staynest:push-owner', 'user-1');
    window.localStorage.setItem('staynest.locale', 'ru');

    await clearPrivateClientData();

    expect(deleted).toEqual(['staynest-me', 'staynest-catalog', 'staynest-media']);
    expect(deleteDatabase).toHaveBeenCalledWith('staynest');
    expect(window.localStorage.getItem('staynest:listing-draft:abc')).toBeNull();
    expect(window.localStorage.getItem('staynest:push-owner')).toBeNull();
    expect(window.localStorage.getItem('staynest.locale')).toBe('ru');
  });

  it('не падает в браузере без Cache Storage и списка IndexedDB', async () => {
    vi.stubGlobal('caches', undefined);
    vi.stubGlobal('indexedDB', undefined);

    await expect(clearPrivateClientData()).resolves.toBeUndefined();
  });
});
