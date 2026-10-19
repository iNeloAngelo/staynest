import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { IconButton } from './IconButton';

type ToastTone = 'info' | 'success' | 'error';

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastItem = ToastInput & { id: number };

type ToastContextValue = {
  show: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_CLOSE_MS = 5000;

const TONE_STYLES: Record<ToastTone, string> = {
  info: 'border-info/30',
  success: 'border-success/30',
  error: 'border-danger/40',
};

const TONE_ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
} as const;

const TONE_ICON_COLORS: Record<ToastTone, string> = {
  info: 'text-info',
  success: 'text-success',
  error: 'text-danger',
};

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-4 bottom-20 z-toast mx-auto flex max-w-md flex-col gap-2 lg:bottom-6"
    >
      {toasts.map((toast) => {
        const tone = toast.tone ?? 'info';
        const Icon = TONE_ICONS[tone];

        return (
          <div
            key={toast.id}
            role={tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'animate-dialog pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface p-4 shadow-md',
              TONE_STYLES[tone],
            )}
          >
            <Icon
              className={cn('mt-0.5 size-5 shrink-0', TONE_ICON_COLORS[tone])}
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <p className="text-small font-semibold text-ink">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-small text-ink-muted">{toast.description}</p>
              ) : null}
            </div>

            <IconButton
              label={t('ui.toast.dismiss')}
              onClick={() => dismiss(toast.id)}
              className="-mt-2 -mr-2"
            >
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const tone = input.tone ?? 'info';
      setToasts((current) => [...current, { ...input, id, tone }]);

      // Ошибки не закрываются сами: пользователь должен успеть прочитать причину.
      if (tone !== 'error') {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), AUTO_CLOSE_MS),
        );
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast должен вызываться внутри ToastProvider');
  return value;
}
