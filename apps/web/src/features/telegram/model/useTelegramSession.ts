import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  endSessionLocally,
  getSessionOwner,
  rememberSessionOwner,
  telegramAuthRequest,
} from '../../auth';
import { queryKeys } from '../../../shared/api';
import { getTelegramWebApp, initTelegramUi } from './webapp';

type TelegramSessionState = 'pending' | 'done';

/**
 * Mini App всегда обменивает initData на сессию своего Telegram-пользователя.
 * Проверять /me и доверять живой cookie нельзя: в общем браузере (Telegram Web)
 * она могла остаться от предыдущего человека.
 */
export function useTelegramSession(): TelegramSessionState {
  const queryClient = useQueryClient();
  const app = getTelegramWebApp();
  const [state, setState] = useState<TelegramSessionState>(app?.initData ? 'pending' : 'done');

  useEffect(() => {
    if (!app?.initData) return;

    let cancelled = false;
    initTelegramUi();

    void (async () => {
      try {
        const result = await telegramAuthRequest(app.initData);
        if (cancelled) return;

        const previousOwner = getSessionOwner();
        if (previousOwner !== null && previousOwner !== result.user.id) {
          // Чужие кэши и push-подписка не должны перейти новому Telegram-аккаунту.
          await endSessionLocally(queryClient, { detachPush: true });
        }

        rememberSessionOwner(result.user.id);
        queryClient.setQueryData(queryKeys.me, result.user);
      } catch {
        // Telegram выключен на сервере или initData устарел: не ломаем гостевой режим.
      } finally {
        if (!cancelled) setState('done');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [app, queryClient]);

  return state;
}
