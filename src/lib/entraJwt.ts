import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { getEntraAuthConfig } from '@/lib/entraConfig';
import { parseEntraIdentityFromJwt, type EntraTokenIdentity } from '@/lib/entraAppRoles';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksTenantId: string | null = null;

function getJwks(tenantId: string): ReturnType<typeof createRemoteJWKSet> {
  if (jwks && jwksTenantId === tenantId) return jwks;
  jwksTenantId = tenantId;
  jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));
  return jwks;
}

function acceptedAudiences(clientId: string): string[] {
  return [clientId, `api://${clientId}`];
}

export interface ValidatedEntraAccessToken extends EntraTokenIdentity {
  payload: JWTPayload;
}

/** Validate an Azure AD access token (signature + issuer + audience). */
export async function validateEntraAccessToken(accessToken: string): Promise<ValidatedEntraAccessToken | null> {
  const config = getEntraAuthConfig();
  if (!config) return null;

  try {
    const { payload } = await jwtVerify(accessToken, getJwks(config.tenantId), {
      issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
      audience: acceptedAudiences(config.clientId),
    });
    const identity = parseEntraIdentityFromJwt(accessToken);
    if (!identity) return null;
    return { ...identity, payload };
  } catch {
    return null;
  }
}
