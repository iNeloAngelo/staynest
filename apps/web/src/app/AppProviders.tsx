import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ModeProvider } from '../features/mode-switch';
import { ToastProvider } from '../shared/ui';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ModeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ModeProvider>
    </QueryClientProvider>
  );
}
