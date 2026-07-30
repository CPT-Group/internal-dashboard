import { createPrivateKey, type KeyObject } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * GitHub App installation-token helper for server-side deploy-status (and similar) calls.
 *
 * Env:
 * - `GITHUB_APP_ID` — numeric App ID
 * - `GITHUB_APP_INSTALLATION_ID` — org install ID (URL …/installations/<id>)
 * - `GITHUB_APP_PRIVATE_KEY` — PEM (raw, `\n`-escaped, or base64 of the PEM)
 */

const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'cpt-internal-dashboard';

/** Installation tokens last ~1h; refresh a few minutes early. */
const INSTALLATION_TOKEN_TTL_MS = 55 * 60_000;

interface CachedInstallationToken {
  token: string;
  expiresAtMs: number;
}

let cachedInstallationToken: CachedInstallationToken | null = null;

export function hasGitHubAppConfig(): boolean {
  return Boolean(
    process.env.GITHUB_APP_ID?.trim() &&
      process.env.GITHUB_APP_INSTALLATION_ID?.trim() &&
      process.env.GITHUB_APP_PRIVATE_KEY?.trim()
  );
}

/** Normalize PEM from Netlify-style single-line / base64 env values. */
export function normalizeGitHubAppPrivateKey(raw: string): string {
  let value = raw.trim();
  if (
    !value.includes('BEGIN') &&
    /^[A-Za-z0-9+/=\s]+$/.test(value) &&
    value.replace(/\s+/g, '').length % 4 === 0
  ) {
    try {
      const decoded = Buffer.from(value.replace(/\s+/g, ''), 'base64').toString('utf8');
      if (decoded.includes('BEGIN')) value = decoded.trim();
    } catch {
      // keep original
    }
  }
  value = value.replace(/\\n/g, '\n');
  if (!value.endsWith('\n')) value = `${value}\n`;
  return value;
}

async function loadPrivateKey(pem: string): Promise<KeyObject | CryptoKey> {
  // PKCS#1 (BEGIN RSA PRIVATE KEY) → Node KeyObject; PKCS#8 → jose importPKCS8.
  if (pem.includes('BEGIN RSA PRIVATE KEY')) {
    return createPrivateKey(pem);
  }
  return importPKCS8(pem, 'RS256');
}

async function createAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const key = await loadPrivateKey(privateKeyPem);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(appId)
    .sign(key);
}

/**
 * Returns a short-lived installation access token (cached ~55m).
 * Throws if App env is missing or GitHub rejects the JWT / install.
 */
export async function getGitHubAppInstallationToken(): Promise<string> {
  const now = Date.now();
  if (cachedInstallationToken && cachedInstallationToken.expiresAtMs > now) {
    return cachedInstallationToken.token;
  }

  const appId = process.env.GITHUB_APP_ID?.trim();
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID?.trim();
  const privateKeyRaw = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!appId || !installationId || !privateKeyRaw) {
    throw new Error(
      'Missing GitHub App config (set GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY)'
    );
  }

  const jwt = await createAppJwt(appId, normalizeGitHubAppPrivateKey(privateKeyRaw));
  const res = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': USER_AGENT,
      },
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    const text = await res.text();
    cachedInstallationToken = null;
    throw new Error(
      `GitHub App installation token failed (${res.status})${text ? `: ${text.slice(0, 160)}` : ''}`
    );
  }

  const data = (await res.json()) as { token?: string; expires_at?: string };
  if (typeof data.token !== 'string' || data.token.length === 0) {
    throw new Error('GitHub App installation token response missing token');
  }

  const expiresAtMs =
    typeof data.expires_at === 'string' && data.expires_at
      ? Date.parse(data.expires_at) - 2 * 60_000
      : now + INSTALLATION_TOKEN_TTL_MS;

  cachedInstallationToken = {
    token: data.token,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : now + INSTALLATION_TOKEN_TTL_MS,
  };
  return data.token;
}
