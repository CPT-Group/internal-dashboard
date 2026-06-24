/** Entra ID configuration for Cursor analytics (server + public client id). */

export interface EntraAuthConfig {
  tenantId: string;
  clientId: string;
  authority: string;
  apiScope: string;
  sessionSecret: string;
}

function readNonEmpty(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw && raw.length > 0 ? raw : null;
}

/** Public SPA client id (also used as token audience for app-role validation). */
export function getEntraClientId(): string | null {
  return readNonEmpty('NEXT_PUBLIC_ENTRA_CLIENT_ID');
}

/** Whether all required Entra auth env vars are present. When false, routes fail closed. */
export function isEntraAuthConfigured(): boolean {
  return getEntraAuthConfig() !== null;
}

/** Resolved config or null when misconfigured (fail closed). */
export function getEntraAuthConfig(): EntraAuthConfig | null {
  const tenantId = readNonEmpty('ENTRA_TENANT_ID');
  const clientId = getEntraClientId();
  const sessionSecret = readNonEmpty('CURSOR_ANALYTICS_SESSION_SECRET');
  if (!tenantId || !clientId || !sessionSecret) return null;

  const scopeOverride = readNonEmpty('ENTRA_API_SCOPE');
  const apiScope = scopeOverride ?? `api://${clientId}/.default`;

  return {
    tenantId,
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    apiScope,
    sessionSecret,
  };
}

/** Client-safe MSAL config (no secrets). */
export function getEntraClientConfig(): {
  tenantId: string;
  clientId: string;
  authority: string;
  apiScope: string;
} | null {
  const tenantId = readNonEmpty('NEXT_PUBLIC_ENTRA_TENANT_ID') ?? readNonEmpty('ENTRA_TENANT_ID');
  const clientId = getEntraClientId();
  if (!tenantId || !clientId) return null;

  const scopeOverride = readNonEmpty('NEXT_PUBLIC_ENTRA_API_SCOPE') ?? readNonEmpty('ENTRA_API_SCOPE');
  const apiScope = scopeOverride ?? `api://${clientId}/.default`;

  return {
    tenantId,
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    apiScope,
  };
}
