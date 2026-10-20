import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../../shared/ui';
import { useTelegramSession } from '../model/useTelegramSession';

function TelegramBoot() {
  const { t } = useTranslation();

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-page flex-col gap-4 px-4 py-10"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        {t('common.loading')}
      </p>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

/** Ждёт обмен initData, чтобы глубокие ссылки не редиректили на /login раньше времени. */
export function TelegramSessionGate({ children }: { children: ReactNode }) {
  const state = useTelegramSession();
  if (state === 'pending') return <TelegramBoot />;
  return <>{children}</>;
}
