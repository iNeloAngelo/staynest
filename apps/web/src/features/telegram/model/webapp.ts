import { applyTheme, hasStoredThemePreference } from '../../../shared/lib/theme';

export type TelegramHapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

type TelegramButton = {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
};

export type TelegramWebApp = {
  initData: string;
  colorScheme?: 'light' | 'dark';
  themeParams?: { bg_color?: string; secondary_bg_color?: string };
  ready?(): void;
  expand?(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  BackButton?: TelegramButton;
  MainButton?: TelegramButton & {
    text: string;
    isVisible: boolean;
    setText(text: string): void;
  };
  HapticFeedback?: {
    impactOccurred(style: TelegramHapticStyle): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Telegram сам внедряет объект WebApp в страницу; внешний скрипт не нужен. */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function telegramInitData(): string {
  return getTelegramWebApp()?.initData ?? '';
}

export function isTelegramWebApp(): boolean {
  return telegramInitData().length > 0;
}

function attempt(action: () => void): void {
  try {
    action();
  } catch {
    // Старая версия клиента может не поддерживать метод — это не ошибка приложения.
  }
}

/** Готовность, разворот на весь экран и цвета Telegram. */
export function initTelegramUi(): void {
  const app = getTelegramWebApp();
  if (!app) return;

  attempt(() => app.ready?.());
  attempt(() => app.expand?.());
  attempt(() => app.disableVerticalSwipes?.());

  const scheme = app.colorScheme === 'dark' ? 'dark' : 'light';
  if (!hasStoredThemePreference()) applyTheme(scheme, false);

  const background = app.themeParams?.bg_color;
  if (background) {
    attempt(() => app.setHeaderColor?.(background));
    attempt(() => app.setBackgroundColor?.(background));
  }
}

export function hapticImpact(style: TelegramHapticStyle = 'light'): void {
  const app = getTelegramWebApp();
  if (!app?.initData || !app.HapticFeedback) return;
  attempt(() => app.HapticFeedback?.impactOccurred(style));
}
