"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APP_THEMES, type AppTheme, DEFAULT_THEME, isAppTheme, THEME_STORAGE_KEY } from '@/lib/theme';

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (nextTheme: AppTheme) => void;
  themes: typeof APP_THEMES;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Only call on the client — reads from dataset (set by inline script) or localStorage. */
function readClientTheme(): AppTheme {
  if (typeof document !== 'undefined') {
    const datasetTheme = document.documentElement.dataset.theme;
    if (isAppTheme(datasetTheme)) return datasetTheme;
  }
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isAppTheme(saved)) return saved;
  } catch { /* localStorage unavailable */ }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always start with DEFAULT during SSR/hydration to avoid mismatch.
  // The inline <script> in layout.tsx has already set data-theme correctly on the DOM,
  // so CSS is correct from first paint — we just need React state to catch up.
  const [theme, setThemeState] = useState<AppTheme>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const clientTheme = readClientTheme();
    if (clientTheme !== theme) setThemeState(clientTheme);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try { window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme); } catch { /* ignore */ }
  }, []);

  // Sync data-theme whenever state changes (after initial mount)
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme, ready]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme,
    themes: APP_THEMES,
  }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}