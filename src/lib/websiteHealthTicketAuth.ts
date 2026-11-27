import { sharedSecretMatches } from '@/lib/sharedSecret';

/** Server-only env var holding the shared secret. Unset = ticket creation disabled (fail closed). */
export const WEBSITE_HEALTH_TICKET_SECRET_ENV = 'WEBSITE_HEALTH_TICKET_SECRET';

/** Request header a server-side caller must send, carrying the shared secret. */
export const WEBSITE_HEALTH_TICKET_SECRET_HEADER = 'x-website-health-ticket-secret';

/**
 * Authorize `POST /api/jira/website-health-ticket`. Returns a refusal Response, or null when the
 * caller presented the shared secret.
 *
 * Only server-to-server callers can hold this secret. It must never be shipped to the browser
 * (no NEXT_PUBLIC_* copy), so the Website Health page's in-browser "create ticket" button is
 * refused until ticket creation moves behind an authenticated server path.
 */
export function authorizeWebsiteHealthTicketRequest(headers: Headers): Response | null {
  const expected = process.env[WEBSITE_HEALTH_TICKET_SECRET_ENV]?.trim();
  if (!expected) {
    return Response.json(
      { ok: false, message: 'Jira ticket creation is not enabled on this deployment.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (!sharedSecretMatches(headers.get(WEBSITE_HEALTH_TICKET_SECRET_HEADER), expected)) {
    return Response.json(
      { ok: false, message: 'Unauthorized.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return null;
}
