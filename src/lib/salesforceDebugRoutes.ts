/**
 * Gate for the Salesforce developer/debug routes (`/api/salesforce/query`, `/api/salesforce/discover`).
 *
 * Disabled by default: the routes answer 404 unless the server-only env var
 * `SALESFORCE_DEBUG_ROUTES_ENABLED` is exactly `true`. Any other value, or unset, fails closed.
 * Never expose this as a `NEXT_PUBLIC_*` variable.
 */
export const SALESFORCE_DEBUG_ROUTES_ENV = 'SALESFORCE_DEBUG_ROUTES_ENABLED';

export function areSalesforceDebugRoutesEnabled(): boolean {
  return process.env[SALESFORCE_DEBUG_ROUTES_ENV]?.trim() === 'true';
}

export function salesforceDebugRoutesDisabledResponse(): Response {
  return Response.json(
    { success: false, message: 'Not found.' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  );
}
