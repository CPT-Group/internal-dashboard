'use client';

import { useEffect, useRef } from 'react';
import { Toast } from 'primereact/toast';
import type { Toast as ToastType } from 'primereact/toast';
import { isAppTheme } from '@/constants/appThemeCycle';

interface ThemeToastDetail {
  theme: string;
}

const TITLE_BY_THEME: Record<string, string> = {
  'light': 'Light',
  'dark': 'Dark',
  'atlas-light': 'Atlas Light',
  'atlas-blue': 'Atlas Blue',
  'khaki': 'Khaki',
  'light-synth': 'Light Synth',
  'dark-synth': 'Dark Synth',
  'ms-access-2010': 'MS Access 2010',
  'miami-vice': 'Miami Vice',
  'cpt-barbie': 'CPT Barbie',
  'dark-barbie': 'CPT Dark Barbie',
  'floral': 'Floral',
  'night-vision': 'Night Vision',
  'summer': 'Summer',
  'github-dark': 'GitHub Dark',
  'github-light': 'GitHub Light',
  'frostbyte': 'Frostbyte',
  'embercore': 'Embercore',
  'abyss': 'Abyss',
  'tempest': 'Tempest',
  'midas': 'Midas',
  'aurora': 'Aurora',
  'evergreen': 'Evergreen',
  'maple': 'Maple',
  'bloom': 'Bloom',
  'espresso': 'Espresso',
  'moonstone': 'Moonstone',
  'rosegold': 'Rosegold',
  'cpt-cyberpunk': 'CPT Cyberpunk',
  'nightfang': 'Nightfang',
  'neon-district': 'Neon District',
  'macaron': 'Macaron',
  'arcane': 'Arcane',
  'cpt-vault': 'CPT Vault',
  'biohack': 'Biohack',
  'hearth': 'Hearth',
  'tundra': 'Tundra',
  'cpt-paperwork': 'CPT Paperwork',
  'colorblind-red-light': 'Colorblind Red Light',
  'colorblind-red-dark': 'Colorblind Red Dark',
  'colorblind-green-light': 'Colorblind Green Light',
  'colorblind-green-dark': 'Colorblind Green Dark',
  'colorblind-blue-yellow-light': 'Colorblind Blue-Yellow Light',
  'colorblind-blue-yellow-dark': 'Colorblind Blue-Yellow Dark',
  'colorblind-mono-light': 'Colorblind Mono Light',
  'colorblind-mono-dark': 'Colorblind Mono Dark',
  'all-american': 'All American Light',
  'all-american-night': 'All American Dark',
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
