/** Decode Entra App Roles from a JWT payload (no signature verification). */

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeRolesClaim(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.filter((r): r is string => typeof r === 'string');
  if (typeof claim === 'string' && claim.length > 0) return [claim];
  return [];
}

export function parseEntraAppRolesFromJwt(token: string | null | undefined): string[] {
  if (!token) return [];
  const parts = token.split('.');
  if (parts.length < 2) return [];
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    return normalizeRolesClaim(payload.roles);
  } catch {
    return [];
  }
}

export interface EntraTokenIdentity {
  oid: string;
  name: string | null;
  email: string | null;
  roles: string[];
}

export function parseEntraIdentityFromJwt(token: string): EntraTokenIdentity | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    const oid = typeof payload.oid === 'string' ? payload.oid : typeof payload.sub === 'string' ? payload.sub : null;
    if (!oid) return null;
    const name =
      typeof payload.name === 'string'
        ? payload.name
        : typeof payload.preferred_username === 'string'
          ? payload.preferred_username
          : null;
    const email =
      typeof payload.preferred_username === 'string'
        ? payload.preferred_username
        : typeof payload.upn === 'string'
          ? payload.upn
          : typeof payload.email === 'string'
            ? payload.email
            : null;
    return {
      oid,
      name,
      email,
      roles: normalizeRolesClaim(payload.roles),
    };
  } catch {
    return null;
  }
}
