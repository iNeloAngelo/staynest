import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const SESSION_OWNER_KEY = 'staynest:session-owner';
const SESSION_ENDED_KEY = 'staynest:session-ended';
const SESSION_ENDED_EVENT = 'staynest:session-ended';

function readOwner(): string | null {
  try {
    return window.localStorage.getItem(SESSION_OWNER_KEY);
  } catch {
    return null;
  }
}

export function getSessionOwner(): string | null {
  return readOwner();
}

export function hasRememberedSession(): boolean {
  return readOwner() !== null;
}

export function rememberSessionOwner(userId: string): void {
  try {
    window.localStorage.setItem(SESSION_OWNER_KEY, userId);
  } catch {
    // Приватный режим: ключ нужен только для очистки после истечения сессии.
  }
}

export function forgetSessionOwner(): void {
  try {
    window.localStorage.removeItem(SESSION_OWNER_KEY);
  } catch {
    // Хранилище могло быть недоступно с самого начала.
  }
}

/**
 * Другие вкладки узнают о выходе через storage-событие, текущая — через
 * CustomEvent: storage в том же документе не срабатывает.
 */
export function notifySessionEnded(): void {
  try {
    window.localStorage.setItem(SESSION_ENDED_KEY, `${Date.now()}:${Math.random()}`);
  } catch {
    // Без localStorage остаётся событие текущей вкладки.
  }

  window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}

export function useCrossTabSessionEnd(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const clear = () => queryClient.clear();
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_ENDED_KEY) return;
      clear();
      // Другая вкладка уже не имеет сессии: закрываем её приватные экраны.
      window.location.assign('/');
    };
    const onLocal = () => clear();

    window.addEventListener('storage', onStorage);
    window.addEventListener(SESSION_ENDED_EVENT, onLocal);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SESSION_ENDED_EVENT, onLocal);
    };
  }, [queryClient]);
}
