'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  type AppTheme,
  nextAppThemeAfter,
  parsePersistedAppTheme,
} from '@/constants/appThemeCycle';

export type Theme = AppTheme;

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setThemeState] = useState<Theme>('dark-synth');
  const [mounted, setMounted] = useState(false);

  const emitThemeToast = (nextTheme: Theme) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('cpt-theme-toast', { detail: { theme: nextTheme } }));
  };

  useEffect(() => {
    const savedTheme = parsePersistedAppTheme(localStorage.getItem('cpt-theme'));
    setThemeState(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cpt-theme', theme);
  }, [theme, mounted]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    emitThemeToast(next);
  };

  const cycleTheme = () => {
    const next = nextAppThemeAfter(theme);
    setThemeState(next);
    emitThemeToast(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
