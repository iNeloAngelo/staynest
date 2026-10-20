import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'staynest.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#FAF7F2',
  dark: '#141A17',
};

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  );
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference;
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isPreference(stored)) return stored;
  } catch {
    // Приватный режим: тема останется системной.
  }

  return 'system';
}

/** Нужен Telegram Mini App: тему Telegram применяем только без ручного выбора. */
export function hasStoredThemePreference(): boolean {
  try {
    return isPreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return false;
  }
}

function updateThemeColor(theme: ResolvedTheme): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }

  meta.content = THEME_COLORS[theme];
}

/** Применяет тему до первого рендера React, чтобы не было вспышки светлой темы. */
export function applyTheme(preference: ThemePreference, persist = true): ResolvedTheme {
  const theme = resolveTheme(preference);

  if (preference === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = preference;
  }

  updateThemeColor(theme);

  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Тема продолжит работать до перезагрузки.
    }
  }

  return theme;
}

export function initTheme(): ResolvedTheme {
  return applyTheme(readThemePreference(), false);
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(readThemePreference()),
  );

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setResolved(applyTheme(next));
  }, []);

  useEffect(() => {
    applyTheme(preference, false);

    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => setResolved(applyTheme(preference, false));

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  return { preference, resolved, setPreference };
}
