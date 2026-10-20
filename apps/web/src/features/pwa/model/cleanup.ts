const KEEP_CACHE_PREFIXES = ['workbox-precache'];

const PRIVATE_LOCAL_KEY_PREFIXES = ['staynest:listing-draft:', 'staynest:push-owner'];

async function clearServiceWorkerCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;

  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => !KEEP_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)))
      .map((name) => caches.delete(name)),
  );
}

async function clearIndexedDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  const factory = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  if (!factory.databases) return;

  try {
    const databases = await factory.databases();
    await Promise.all(
      databases
        .map((database) => database.name)
        .filter((name): name is string => Boolean(name))
        .map(
          (name) =>
            new Promise<void>((resolve) => {
              const request = indexedDB.deleteDatabase(name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            }),
        ),
    );
  } catch {
    // Некоторые браузеры не отдают список баз: чистим хотя бы Cache Storage.
  }
}

function clearPrivateLocalStorage(): void {
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index),
    ).filter((key): key is string => Boolean(key));

    for (const key of keys) {
      if (PRIVATE_LOCAL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Хранилище могло быть недоступно с самого начала.
  }
}

/**
 * Выход из аккаунта на общем устройстве: убираем персональные данные
 * из Cache Storage, IndexedDB и localStorage. Precache оболочки остаётся,
 * иначе приложение перестанет открываться офлайн до следующего визита.
 */
export async function clearPrivateClientData(): Promise<void> {
  clearPrivateLocalStorage();
  await Promise.all([clearServiceWorkerCaches(), clearIndexedDb()]);
}
