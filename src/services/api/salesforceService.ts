/**
 * Salesforce REST API client (server-side only, read-only).
 * Uses OAuth2 password flow with Connected App credentials and user password + security token.
 * Only import in API route handlers (app/api/salesforce/*).
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/
 */

const SF_API_VERSION = 'v59.0';

interface TokenResponse {
  access_token: string;
  instance_url: string;
  token_type?: string;
}

function getSalesforceConfig(): {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
} {
  const loginUrl = (process.env.SF_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '');
  const clientId = process.env.SF_CLIENT_ID?.trim() || process.env.SALESFORCE_CONSUMER_KEY?.trim();
  const clientSecret = process.env.SF_CLIENT_SECRET?.trim() || process.env.SALESFORCE_CONSUMER_SECRET?.trim();
  const username = process.env.SALESFORCE_EMAIL_KYLE;
  const password = process.env.SALESFORCE_PASSWORD_KYLE;
  const securityToken = process.env.SALESFORCE_SECURITY_TOKEN_KYLE;

  if (!clientId || !clientSecret) {
    throw new Error('SF_CLIENT_ID + SF_CLIENT_SECRET (or SALESFORCE_CONSUMER_KEY + SALESFORCE_CONSUMER_SECRET) are required');
  }
  if (!username?.trim() || !password?.trim()) {
    throw new Error('SALESFORCE_EMAIL_KYLE and SALESFORCE_PASSWORD_KYLE are required');
  }

  const passWithToken = securityToken?.trim() ? `${password}${securityToken}` : password;

  return { loginUrl, clientId, clientSecret, username, password: passWithToken };
}

let cachedToken: { access_token: string; instance_url: string; expiresAt: number } | null = null;
const TOKEN_BUFFER_MS = 60 * 1000;

async function getAccessToken(): Promise<{ access_token: string; instance_url: string }> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_BUFFER_MS) {
    return { access_token: cachedToken.access_token, instance_url: cachedToken.instance_url };
  }

  const { loginUrl, clientId, clientSecret, username, password } = getSalesforceConfig();
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password,
  });

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Salesforce auth error ${res.status}: ${res.statusText}`;
    try {
      const err = JSON.parse(text);
      if (err.error_description) msg = err.error_description;
      else if (err.error) msg = err.error;
    } catch {
      if (text) msg += ` - ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as TokenResponse & { issued_at?: string };
  const issuedAt = data.issued_at ? parseInt(data.issued_at, 10) * 1000 : Date.now();
  const expiresAt = issuedAt + 2 * 60 * 60 * 1000;

  cachedToken = {
    access_token: data.access_token,
    instance_url: data.instance_url.replace(/\/$/, ''),
    expiresAt,
  };

  return { access_token: cachedToken.access_token, instance_url: cachedToken.instance_url };
}

async function sfFetch<T>(path: string): Promise<T> {
  const { access_token, instance_url } = await getAccessToken();
  const url = `${instance_url}/services/data/${SF_API_VERSION}${path}`;

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${access_token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Salesforce API error ${res.status}: ${res.statusText}`;
    try {
      const err = JSON.parse(text);
      if (Array.isArray(err)) msg = err.map((e: { message?: string }) => e.message).filter(Boolean).join('; ');
      else if (err.message) msg = err.message;
    } catch {
      if (text) msg += ` - ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

/** Describe Global – list all sobjects in the org. */
export async function describeGlobal(): Promise<{
  sobjects: Array<{ name: string; label: string; keyPrefix?: string; custom?: boolean }>;
}> {
  const data = await sfFetch<{ sobjects: unknown[] }>('/sobjects');
  const sobjects = ((data.sobjects ?? []) as Record<string, unknown>[]).map((s) => ({
    name: s.name as string,
    label: (s.label as string) ?? '',
    keyPrefix: s.keyPrefix as string | undefined,
    custom: s.custom as boolean | undefined,
  }));
  return { sobjects };
}

/** Describe a single sobject – full metadata (fields, etc.). */
export async function describeSObject(sobject: string): Promise<Record<string, unknown>> {
  const name = sobject.trim();
  if (!name) throw new Error('sobject name is required');
  return sfFetch<Record<string, unknown>>(`/sobjects/${encodeURIComponent(name)}/describe`);
}

/** Run a SOQL query (read-only). Returns query result with records. */
export async function query<T = Record<string, unknown>>(soql: string): Promise<{
  totalSize: number;
  done: boolean;
  records: T[];
}> {
  const q = soql.trim();
  if (!q.toLowerCase().startsWith('select ')) throw new Error('SOQL must be a SELECT query');
  const data = await sfFetch<{ totalSize: number; done: boolean; records: T[] }>(
    `/query?q=${encodeURIComponent(q)}`
  );
  return {
    totalSize: data.totalSize ?? 0,
    done: data.done ?? true,
    records: data.records ?? [],
  };
}
