'use client';

import { ReactNode } from 'react';
import { PrimeReactProvider } from './PrimeReactProvider';
import { ThemeProvider } from './ThemeProvider';
import { ThemeChangeToast } from './ThemeChangeToast';
import { ThemeAmbientLayer } from '@/components/ThemeAmbientLayer';

interface ProvidersProps {
  children: ReactNode;
}

export const Providers = ({ children }: ProvidersProps) => {
  return (
    <ThemeProvider>
      <PrimeReactProvider>
        {children}
        <ThemeChangeToast />
        <ThemeAmbientLayer />
      </PrimeReactProvider>
    </ThemeProvider>
  );
};
