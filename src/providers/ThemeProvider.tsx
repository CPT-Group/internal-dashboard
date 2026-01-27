'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
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
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Get theme from localStorage or default to dark
    const savedTheme = (localStorage.getItem('cpt-theme') as Theme) || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Update ThemeLink href when theme changes
    const linkId = 'theme-link';
    const linkElement = document.getElementById(linkId) as HTMLLinkElement;
    
    if (linkElement) {
      const themePath = theme === 'light' 
        ? '/themes/cpt-legacy-light/theme.css'
        : '/themes/cpt-legacy-dark/theme.css';
      linkElement.href = themePath;
    }

    // Set data-theme attribute
    document.documentElement.setAttribute('data-theme', theme);

    // Save to localStorage
    localStorage.setItem('cpt-theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};
