import type { HealthResponse } from '@staynest/shared';
import { useQuery } from '@tanstack/react-query';

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/v1/health');

  if (!response.ok) {
    throw new Error(`API ответил ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}

export function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-4 py-12">
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">StayNest</p>

      <h1 className="font-serif text-4xl leading-tight text-ink">Дом, который ждёт вас</h1>

      <p className="max-w-prose text-base leading-relaxed text-ink-muted">
        Каркас приложения готов. Каталог домов, календарь свободных дат и бронирование появятся в
        следующих сессиях.
      </p>

      <section
        aria-live="polite"
        className="rounded-lg border border-border bg-surface p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-ink">Состояние API</h2>

        {health.isPending ? <p className="mt-2 text-sm text-ink-muted">Проверяем…</p> : null}

        {health.isError ? (
          <p className="mt-2 text-sm text-danger">
            API недоступен. Запустите <code>pnpm dev</code> и обновите страницу.
          </p>
        ) : null}

        {health.data ? (
          <p className="mt-2 text-sm text-ink">
            Статус: {health.data.status}, база: {health.data.db}, версия: {health.data.version}
          </p>
        ) : null}
      </section>
    </main>
  );
}
