'use client';

import { ReactNode } from 'react';
import { PrimeReactProvider } from './PrimeReactProvider';
import { ThemeProvider } from './ThemeProvider';

interface ProvidersProps {
  children: ReactNode;
}

export const Providers = ({ children }: ProvidersProps) => {
  return (
    <ThemeProvider>
      <PrimeReactProvider>{children}</PrimeReactProvider>
    </ThemeProvider>
  );
};
