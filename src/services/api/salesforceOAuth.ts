/**
 * Salesforce OAuth2 Authorization Code flow with PKCE (server-side only).
 * Used for CPT TV Connected App: /oauth/start, /oauth/callback, token file .sf_tokens.json.
 * Supports SALESFORCE_CONSUMER_KEY/SECRET or SF_CLIENT_ID/SF_CLIENT_SECRET.
 */

import { createHash, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const SF_API_VERSION = process.env.SF_API_VERSION || 'v60.0';
const TOKEN_FILE = '.sf_tokens.json';

function getClientCreds(): { clientId: string; clientSecret: string } {
  const clientId =
    process.env.SF_CLIENT_ID?.trim() ||
    process.env.SALESFORCE_CONSUMER_KEY?.trim();
  const clientSecret =
    process.env.SF_CLIENT_SECRET?.trim() ||
    process.env.SALESFORCE_CONSUMER_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Salesforce OAuth requires SF_CLIENT_ID + SF_CLIENT_SECRET (or SALESFORCE_CONSUMER_KEY + SALESFORCE_CONSUMER_SECRET)'
    );
  }
  return { clientId, clientSecret };
}

export function getLoginUrl(): string {
  return (process.env.SF_LOGIN_URL || 'https://login.salesforce.com').replace(
    /\/$/,
    ''
  );
}

/** Redirect URI must match Connected App callback URLs. Pass request origin e.g. http://localhost:3333. */
export function getRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/oauth/callback`;
}

/** Generate PKCE code_verifier (43 chars) and code_challenge (base64url SHA256). */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Build Salesforce authorize URL for Authorization Code + PKCE.
 * origin: e.g. http://localhost:3333 (for redirect_uri).
 */
export function buildAuthorizeUrl(
  origin: string,
  state: string,
  codeChallenge: string
): string {
  const { clientId } = getClientCreds();
  const loginUrl = getLoginUrl();
  const redirectUri = getRedirectUri(origin);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'api refresh_token',
  });
  return `${loginUrl}/services/oauth2/authorize?${params.toString()}`;
}

export interface StoredTokens {
  access_token: string;
  instance_url: string;
  refresh_token?: string;
  issued_at?: number;
}

/**
 * Exchange authorization code for tokens. Persist to .sf_tokens.json in project root.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<StoredTokens> {
  const { clientId, clientSecret } = getClientCreds();
  const loginUrl = getLoginUrl();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Salesforce token exchange error ${res.status}: ${res.statusText}`;
    try {
      const err = JSON.parse(text);
      if (err.error_description) msg = err.error_description;
    } catch {
      if (text) msg += ` - ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as {
    access_token: string;
    instance_url: string;
    refresh_token?: string;
    issued_at?: string;
  };

  const tokens: StoredTokens = {
    access_token: data.access_token,
    instance_url: data.instance_url.replace(/\/$/, ''),
    refresh_token: data.refresh_token,
    issued_at: data.issued_at ? parseInt(data.issued_at, 10) : undefined,
  };

  const projectRoot = process.cwd();
  const tokenPath = join(projectRoot, TOKEN_FILE);
  writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
  console.log('[SF OAuth] Tokens saved to', tokenPath, 'instance_url:', tokens.instance_url);

  return tokens;
}

/**
 * Read stored tokens from .sf_tokens.json. Throws if file missing or invalid.
 */
export function readStoredTokens(): StoredTokens {
  const projectRoot = process.cwd();
  const tokenPath = join(projectRoot, TOKEN_FILE);
  if (!existsSync(tokenPath)) {
    throw new Error(
      'No Salesforce tokens found. Complete OAuth flow: GET /oauth/start then /oauth/callback'
    );
  }
  const raw = readFileSync(tokenPath, 'utf8');
  const data = JSON.parse(raw) as StoredTokens;
  if (!data.access_token || !data.instance_url) {
    throw new Error('Invalid .sf_tokens.json: missing access_token or instance_url');
  }
  return data;
}

/**
 * Call Salesforce REST with stored token (for whoami, describe, create).
 * path: e.g. /sobjects/Support_Channel__c/describe (REST data) or /services/oauth2/userinfo (identity).
 */
export async function sfFetchWithStoredToken<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const tokens = readStoredTokens();
  const url = path.startsWith('http')
    ? path
    : path.startsWith('/services/oauth2')
      ? `${tokens.instance_url}${path}`
      : `${tokens.instance_url}/services/data/${SF_API_VERSION}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokens.access_token}`,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Salesforce API error ${res.status}: ${res.statusText}`;
    try {
      const err = JSON.parse(text);
      if (Array.isArray(err)) msg = err.map((e: { message?: string }) => e.message).join('; ');
      else if (err.error_description) msg = err.error_description;
      else if (err.message) msg = err.message;
    } catch {
      if (text) msg += ` - ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}
