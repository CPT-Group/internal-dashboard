import { NextRequest } from 'next/server';
import { describeGlobal, describeSObject } from '@/services/api/salesforceService';

export const dynamic = 'force-dynamic';

/**
 * Discovery endpoint: list sobjects or describe one.
 * GET /api/salesforce/discover           → describeGlobal (all sobjects)
 * GET /api/salesforce/discover?sobject=Account → describe for that sobject (fields, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sobject = searchParams.get('sobject');

    if (sobject?.trim()) {
      const describe = await describeSObject(sobject.trim());
      return Response.json({ success: true, describe });
    }

    const { sobjects } = await describeGlobal();
    return Response.json({
      success: true,
      sobjects,
      hint: 'Add ?sobject=Account (or another name) to get full metadata for one object.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salesforce discovery failed';
    return Response.json({ success: false, message }, { status: 500 });
  }
}
