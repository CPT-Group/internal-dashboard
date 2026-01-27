'use client';

import { PrimeReactProvider as PRProvider } from 'primereact/api';
import { ReactNode } from 'react';

// Import PrimeReact core styles
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';

// Theme CSS will be loaded dynamically via link element in ThemeProvider
// Themes are in public/themes folder (cpt-legacy-light and cpt-legacy-dark - customized CPT brand themes)

interface PrimeReactProviderProps {
  children: ReactNode;
}

export const PrimeReactProvider = ({ children }: PrimeReactProviderProps) => {
  return <PRProvider>{children}</PRProvider>;
};
