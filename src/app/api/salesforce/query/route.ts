import { NextRequest } from 'next/server';
import { query } from '@/services/api/salesforceService';
import {
  areSalesforceDebugRoutesEnabled,
  salesforceDebugRoutesDisabledResponse,
} from '@/lib/salesforceDebugRoutes';

export const dynamic = 'force-dynamic';

/**
 * Run a read-only SOQL query (GET so you can try in browser).
 * GET /api/salesforce/query?q=SELECT Id, Name FROM Account LIMIT 10
 * Only SELECT queries are allowed.
 * Disabled (404) unless SALESFORCE_DEBUG_ROUTES_ENABLED=true (server-only env).
 */
export async function GET(request: NextRequest) {
  if (!areSalesforceDebugRoutesEnabled()) return salesforceDebugRoutesDisabledResponse();

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q?.trim()) {
      return Response.json(
        { success: false, message: 'Missing query: q (SOQL SELECT only)' },
        { status: 400 }
      );
    }

    const result = await query(q.trim());
    return Response.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salesforce query failed';
    return Response.json({ success: false, message }, { status: 500 });
  }
}
