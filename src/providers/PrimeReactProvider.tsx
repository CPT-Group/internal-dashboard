'use client';

import { PrimeReactProvider as PRProvider } from 'primereact/api';
import { ReactNode } from 'react';

// Import PrimeReact core styles
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';

// Theme: PrimeReact lara-dark-blue + app SCSS (variables, base, theme overrides).
// ThemeProvider sets data-theme on <html>; dark-synth is default.

interface PrimeReactProviderProps {
  children: ReactNode;
}

export const PrimeReactProvider = ({ children }: PrimeReactProviderProps) => {
  return <PRProvider>{children}</PRProvider>;
};
