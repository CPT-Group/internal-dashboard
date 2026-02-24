import { NextRequest } from 'next/server';
import { exchangeCodeForTokens, getRedirectUri, readStoredTokens } from '@/services/api/salesforceOAuth';

export const dynamic = 'force-dynamic';

const COOKIE_NAME_STATE = 'sf_oauth_state';
const COOKIE_NAME_VERIFIER = 'sf_oauth_code_verifier';

function getCookie(request: NextRequest, name: string): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * GET /oauth/callback
 * Exchanges code for tokens, persists to .sf_tokens.json, returns "Connected" page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    const desc = searchParams.get('error_description') ?? errorParam;
    console.error('[SF OAuth] Callback error:', errorParam, desc);
    return new Response(
      `<!DOCTYPE html><html><body><h1>OAuth Error</h1><p>${escapeHtml(desc)}</p></body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!code?.trim()) {
    return new Response(
      '<!DOCTYPE html><html><body><h1>Missing code</h1><p>No authorization code in callback.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const savedState = getCookie(request, COOKIE_NAME_STATE);
  const codeVerifier = getCookie(request, COOKIE_NAME_VERIFIER);

  if (!savedState || savedState !== state) {
    return new Response(
      '<!DOCTYPE html><html><body><h1>Invalid state</h1><p>CSRF check failed. Try /oauth/start again.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }
  if (!codeVerifier) {
    return new Response(
      '<!DOCTYPE html><html><body><h1>Missing code_verifier</h1><p>Cookie expired or missing. Try /oauth/start again.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = getRedirectUri(origin);

  const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);
  console.log('[SF OAuth] Token success, instance_url:', tokens.instance_url);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Salesforce Connected</title></head>
<body>
  <h1>Connected</h1>
  <p>Salesforce OAuth succeeded. Tokens saved to <code>.sf_tokens.json</code>.</p>
  <p><strong>instance_url:</strong> ${escapeHtml(tokens.instance_url)}</p>
  <p>You can close this tab. Use <code>GET /api/sf/whoami</code> to verify.</p>
</body>
</html>`;

  const res = new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  res.headers.append('Set-Cookie', `${COOKIE_NAME_STATE}=; Path=/; Max-Age=0`);
  res.headers.append('Set-Cookie', `${COOKIE_NAME_VERIFIER}=; Path=/; Max-Age=0`);
  return res;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
