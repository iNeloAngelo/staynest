import { useEffect, useState } from 'react';

function initialOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/** Состояние сети для баннеров и блокировки действий, которым нужен сервер. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(initialOnline);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
