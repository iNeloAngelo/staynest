import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, initTheme, readThemePreference, resolveTheme, useTheme } from './theme';
import { renderHook, act } from '@testing-library/react';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('тема', () => {
  it('применяет тёмную тему и запоминает выбор', () => {
    applyTheme('dark');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(readThemePreference()).toBe('dark');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      '#141A17',
    );
  });

  it('системная тема убирает атрибут и следует prefers-color-scheme', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );

    expect(resolveTheme('system')).toBe('dark');
    applyTheme('system');

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      '#141A17',
    );
    expect(readThemePreference()).toBe('system');
  });

  it('initTheme применяет сохранённую тему', () => {
    window.localStorage.setItem('staynest.theme', 'light');

    expect(initTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('хук переключает тему и обновляет состояние', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference('dark'));

    expect(result.current.preference).toBe('dark');
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
