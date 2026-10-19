import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type AppMode = 'guest' | 'host';

const MODE_STORAGE_KEY = 'staynest.mode';

type ModeContextValue = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
};

const ModeContext = createContext<ModeContextValue | null>(null);

function readMode(): AppMode {
  try {
    return window.localStorage.getItem(MODE_STORAGE_KEY) === 'host' ? 'host' : 'guest';
  } catch {
    return 'guest';
  }
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(readMode);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Режим продолжит работать до перезагрузки.
    }
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const value = useContext(ModeContext);
  if (!value) throw new Error('useMode должен вызываться внутри ModeProvider');
  return value;
}
