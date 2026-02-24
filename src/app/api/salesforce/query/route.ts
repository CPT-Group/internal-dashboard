import { NextRequest } from 'next/server';
import { query } from '@/services/api/salesforceService';

export const dynamic = 'force-dynamic';

/**
 * Run a read-only SOQL query (GET so you can try in browser).
 * GET /api/salesforce/query?q=SELECT Id, Name FROM Account LIMIT 10
 * Only SELECT queries are allowed.
 */
export async function GET(request: NextRequest) {
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
