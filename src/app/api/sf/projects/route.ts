import { sfFetchWithStoredToken } from '@/services/api/salesforceOAuth';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CaseOptionShape {
  id: string;
  label: string;
  name: string;
  projectName: string;
  caseID: string;
}

let cache: { at: number; cases: CaseOptionShape[] } | null = null;

interface DescribeField {
  name: string;
  type: string;
  referenceTo?: string[];
}

/**
 * GET /api/sf/projects
 * Returns Project__c records as the case list (same shape as support portal CaseOption).
 * Source of truth for cases; cached 5 min to reduce Salesforce API calls.
 * Not yet consumed by any dashboard UI; available for future use.
 */
export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return Response.json({
      success: true,
      cases: cache.cases,
      totalSize: cache.cases.length,
      cached: true,
    });
  }

  const describe = await sfFetchWithStoredToken<{ fields: DescribeField[] }>(
    '/sobjects/Support_Channel__c/describe'
  );
  const projectField = (describe.fields ?? []).find((f) => f.name === 'Project__c');
  const refTo = projectField?.referenceTo?.[0];
  const objectName = refTo ?? 'Project__c';

  const soql = `SELECT Id, Name FROM ${objectName} ORDER BY Name LIMIT 500`;
  const encoded = encodeURIComponent(soql);
  const result = await sfFetchWithStoredToken<{
    totalSize: number;
    records: Array<{ Id: string; Name?: string }>;
  }>(`/query?q=${encoded}`);

  const records = result.records ?? [];
  const cases: CaseOptionShape[] = records.map((r) => ({
    id: r.Id,
    label: r.Name ?? r.Id,
    name: r.Name ?? r.Id,
    projectName: r.Name ?? '',
    caseID: r.Id,
  }));

  cache = { at: now, cases };

  return Response.json({
    success: true,
    cases,
    totalSize: cases.length,
    objectName,
    cached: false,
  });
}
