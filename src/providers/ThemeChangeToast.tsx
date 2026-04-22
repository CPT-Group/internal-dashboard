'use client';

import { useEffect, useRef } from 'react';
import { Toast } from 'primereact/toast';
import type { Toast as ToastType } from 'primereact/toast';
import { isAppTheme } from '@/constants/appThemeCycle';

interface ThemeToastDetail {
  theme: string;
}

const TITLE_BY_THEME: Record<string, string> = {
  dark: 'Dark',
  light: 'Light',
  'dark-synth': 'Dark Synth',
  'ms-access-2010': 'MS Access 2010',
};

function readThemeFromEvent(event: Event): string | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail = event.detail as ThemeToastDetail | null | undefined;
  if (!detail || typeof detail.theme !== 'string') return null;
  return isAppTheme(detail.theme) ? detail.theme : null;
}

export const ThemeChangeToast = () => {
  const toastRef = useRef<ToastType | null>(null);

  useEffect(() => {
    const onThemeToast = (event: Event) => {
      const theme = readThemeFromEvent(event);
      if (!theme) return;
      const name = TITLE_BY_THEME[theme] ?? theme;
      toastRef.current?.show({
        severity: 'info',
        summary: `Theme changed to: ${name}`,
        life: 3000,
      });
    };

    window.addEventListener('cpt-theme-toast', onThemeToast);
    return () => window.removeEventListener('cpt-theme-toast', onThemeToast);
  }, []);

  return <Toast ref={toastRef} position="bottom-right" />;
};
