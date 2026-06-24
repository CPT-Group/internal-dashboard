'use client';

import { MsalProvider } from '@azure/msal-react';
import { useEffect, useState, type ReactNode } from 'react';

import { getCursorAnalyticsMsalInstance } from '@/lib/cursorAnalyticsMsalConfig';

interface CursorAnalyticsMsalProviderProps {
  children: ReactNode;
}

export function CursorAnalyticsMsalProvider({ children }: CursorAnalyticsMsalProviderProps) {
  const [ready, setReady] = useState(false);
  const instance = getCursorAnalyticsMsalInstance();

  useEffect(() => {
    if (!instance) return;
    void instance.initialize().then(() => setReady(true));
  }, [instance]);

  if (!instance) {
    return <>{children}</>;
  }

  if (!ready) {
    return <>{children}</>;
  }

  return <MsalProvider instance={instance}>{children}</MsalProvider>;
}
