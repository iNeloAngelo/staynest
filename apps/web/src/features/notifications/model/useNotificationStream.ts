import { notificationDtoSchema } from '@staynest/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, api } from '../../../shared/api';
import { useToast } from '../../../shared/ui';
import { applyIncomingNotification } from '../api/hooks';
import { NOTIFICATION_META, notificationDescription } from './labels';

const MAX_DELAY_MS = 30_000;

type ToastInput = { title: string; description?: string };

type HandlerDeps = {
  queryClient: QueryClient;
  showToast: (input: ToastInput) => void;
  t: TFunction;
  language: string;
  userId: string;
};

function handleIncoming(deps: HandlerDeps, data: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return;
  }

  const result = notificationDtoSchema.safeParse(parsed);
  if (!result.success) return;

  const notification = result.data;
  const { queryClient } = deps;

  applyIncomingNotification(queryClient, notification, deps.userId);
  void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  void queryClient.invalidateQueries({ queryKey: ['bookings'] });
  void queryClient.invalidateQueries({ queryKey: ['booking'] });
  void queryClient.invalidateQueries({ queryKey: ['host-calendar'] });

  const meta = NOTIFICATION_META[notification.type];
  deps.showToast({
    title: deps.t(meta.titleKey),
    description: notificationDescription(notification, deps.t, deps.language),
  });
}

/**
 * SSE через fetch, а не EventSource: поток переживает истечение access-токена
 * (single-flight refresh) и не требует заголовков поверх cookie.
 */
export function useNotificationStream(enabled: boolean, userId: string | undefined): void {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!enabled || !userId || typeof window === 'undefined') return;

    const translate: TFunction = t;
    const deps: HandlerDeps = {
      queryClient,
      showToast: toast.show,
      t: translate,
      language: i18n.language,
      userId,
    };
    let disposed = false;
    let controller: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    async function connect(): Promise<void> {
      if (disposed) return;
      controller = new AbortController();

      try {
        await api.stream('/me/events', {
          signal: controller.signal,
          onOpen: () => {
            attempt = 0;
          },
          onEvent: (event) => {
            if (event.event === 'notification') handleIncoming(deps, event.data);
          },
        });
      } catch (error) {
        if (disposed) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // 401 после refresh и прочие 4xx (кроме 429) не лечатся повтором.
        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 429
        ) {
          return;
        }
      }

      if (disposed) return;
      attempt += 1;
      const delay = Math.min(MAX_DELAY_MS, 1_000 * 2 ** Math.min(attempt, 4));
      reconnectTimer = setTimeout(() => {
        void connect();
      }, delay);
    }

    void connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      controller?.abort();
    };
  }, [enabled, queryClient, toast, t, i18n.language, userId]);
}
