import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

const SERVICE_WORKER_PATH = '/sw.js';

export type ServiceWorkerUpdate = {
  /** Новый SW установлен и ждёт разрешения на активацию. */
  needRefresh: boolean;
  applyUpdate: () => void;
  dismiss: () => void;
};

function useServiceWorkerRegistration(
  registrationRef: MutableRefObject<ServiceWorkerRegistration | null>,
  reloadingRef: MutableRefObject<boolean>,
  setNeedRefresh: Dispatch<SetStateAction<boolean>>,
): void {
  useEffect(() => {
    if (import.meta.env.DEV || typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    let idleHandle = 0;
    let timeoutHandle = 0;
    const onControllerChange = () => {
      // Первая установка тоже меняет controller; перезагружаем только по кнопке.
      if (reloadingRef.current) window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = () => {
      void navigator.serviceWorker
        .register(SERVICE_WORKER_PATH, { scope: '/' })
        .then((registration) => {
          if (cancelled) return;
          registrationRef.current = registration;

          if (registration.waiting && navigator.serviceWorker.controller) setNeedRefresh(true);

          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;

            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                setNeedRefresh(true);
              }
            });
          });
        })
        .catch(() => {
          // Офлайн-режим не критичен для работы приложения: сеть останется основной.
        });
    };

    // Precaching 1.5 МБ конкурирует с первым рендером на медленной сети.
    // Ставим SW после load и в простой браузера, когда оболочка уже отрисована.
    const schedule = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(register, { timeout: 5000 });
      } else {
        timeoutHandle = window.setTimeout(register, 2000);
      }
    };

    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
      if (idleHandle) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [registrationRef, reloadingRef, setNeedRefresh]);
}

/**
 * Регистрирует Workbox SW в production и следит за обновлениями.
 * В dev SW выключен (vite-plugin-pwa devOptions), поэтому push-сценарий
 * использует отдельный /push-sw.js, а баннер обновления не показывается.
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdate {
  const [needRefresh, setNeedRefresh] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadingRef = useRef(false);

  useServiceWorkerRegistration(registrationRef, reloadingRef, setNeedRefresh);

  const applyUpdate = useCallback(() => {
    const waiting = registrationRef.current?.waiting;
    if (!waiting) {
      setNeedRefresh(false);
      return;
    }

    reloadingRef.current = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, []);

  const dismiss = useCallback(() => setNeedRefresh(false), []);

  return { needRefresh, applyUpdate, dismiss };
}
