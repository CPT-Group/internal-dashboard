import { NextRequest } from 'next/server';
import {
  buildAuthorizeUrl,
  generatePKCE,
  generateState,
  getRedirectUri,
} from '@/services/api/salesforceOAuth';

export const dynamic = 'force-dynamic';

const COOKIE_MAX_AGE = 600;
const COOKIE_NAME_STATE = 'sf_oauth_state';
const COOKIE_NAME_VERIFIER = 'sf_oauth_code_verifier';

/**
 * GET /oauth/start
 * Generates PKCE state + code_verifier, stores in httpOnly cookies, redirects to Salesforce authorize.
 */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();
  const authUrl = buildAuthorizeUrl(origin, state, codeChallenge);

  console.log('[SF OAuth] Start -> redirect_uri:', getRedirectUri(origin));

  const res = new Response(null, { status: 302, headers: { Location: authUrl } });
  res.headers.append(
    'Set-Cookie',
    `${COOKIE_NAME_STATE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
  );
  res.headers.append(
    'Set-Cookie',
    `${COOKIE_NAME_VERIFIER}=${codeVerifier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
  );
  return res;
}
