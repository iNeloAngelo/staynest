import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getTelegramWebApp,
  hapticImpact,
  initTelegramUi,
  isTelegramWebApp,
  telegramInitData,
} from './webapp';
import type { TelegramWebApp } from './webapp';

function install(app: TelegramWebApp): void {
  window.Telegram = { WebApp: app };
}

afterEach(() => {
  delete window.Telegram;
  document.documentElement.removeAttribute('data-theme');
  window.localStorage.clear();
});

describe('Telegram WebApp detection', () => {
  it('вне Telegram возвращает null и пустой initData', () => {
    expect(getTelegramWebApp()).toBeNull();
    expect(isTelegramWebApp()).toBe(false);
    expect(telegramInitData()).toBe('');
  });

  it('видит initData и вызывает haptic без падения', () => {
    const impactOccurred = vi.fn();
    install({
      initData: 'user=%7B%7D&hash=abc',
      HapticFeedback: { impactOccurred, notificationOccurred: vi.fn() },
    });

    expect(isTelegramWebApp()).toBe(true);
    expect(telegramInitData()).toContain('hash=abc');

    hapticImpact('medium');
    expect(impactOccurred).toHaveBeenCalledWith('medium');
  });

  it('с загруженным SDK, но без initData остаётся обычным браузером', () => {
    const impactOccurred = vi.fn();
    const ready = vi.fn();
    install({
      initData: '',
      ready,
      HapticFeedback: { impactOccurred, notificationOccurred: vi.fn() },
    });

    expect(isTelegramWebApp()).toBe(false);

    hapticImpact();
    expect(impactOccurred).not.toHaveBeenCalled();

    initTelegramUi();
    expect(ready).not.toHaveBeenCalled();
  });

  it('готовит UI и применяет тёмную тему Telegram', () => {
    const ready = vi.fn();
    const expand = vi.fn();
    install({ initData: 'x=1', colorScheme: 'dark', ready, expand });

    initTelegramUi();

    expect(ready).toHaveBeenCalled();
    expect(expand).toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('не перетирает ручной выбор темы', () => {
    window.localStorage.setItem('staynest.theme', 'light');
    document.documentElement.dataset.theme = 'light';
    install({ initData: 'x=1', colorScheme: 'dark' });

    initTelegramUi();

    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
