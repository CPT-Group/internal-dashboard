'use client';

import { PublicClientApplication, type Configuration } from '@azure/msal-browser';
import { getEntraClientConfig } from '@/lib/entraConfig';

let msalInstance: PublicClientApplication | null = null;

export function getCursorAnalyticsMsalInstance(): PublicClientApplication | null {
  if (msalInstance) return msalInstance;
  const config = getEntraClientConfig();
  if (!config) return null;

  const msalConfig: Configuration = {
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/cursor-analytics/login` : undefined,
      knownAuthorities: [`${config.tenantId}.login.microsoftonline.com`],
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
  };

  msalInstance = new PublicClientApplication(msalConfig);
  return msalInstance;
}

export function getCursorAnalyticsLoginScopes(): string[] {
  const config = getEntraClientConfig();
  if (!config) return ['openid', 'profile'];
  return ['openid', 'profile', 'email', config.apiScope];
}
