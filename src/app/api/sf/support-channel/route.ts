import { sfFetchWithStoredToken } from '@/services/api/salesforceOAuth';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface SupportChannelRecord {
  Id: string;
  Name?: string;
  CreatedDate?: string;
  Type__c?: string;
  Case_No__c?: string;
  Case_Email__c?: string;
  Stage__c?: string;
  Project__c?: string;
  Website_Detail_Summary__c?: string;
}

let cache: { at: number; data: { totalSize: number; records: SupportChannelRecord[] } } | null = null;

/**
 * GET /api/sf/support-channel
 * Returns Support_Channel__c records (support requests from the support portal).
 * For future use: charts, tables, etc. Cached 5 min. Read-only.
 */
export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return Response.json({
      success: true,
      ...cache.data,
      cached: true,
    });
  }

  const soql = [
    'SELECT Id, Name, CreatedDate, Type__c, Case_No__c, Case_Email__c, Stage__c, Project__c, Website_Detail_Summary__c',
    'FROM Support_Channel__c',
    'ORDER BY CreatedDate DESC',
    'LIMIT 200',
  ].join(' ');
  const encoded = encodeURIComponent(soql);
  const result = await sfFetchWithStoredToken<{
    totalSize: number;
    done: boolean;
    records: SupportChannelRecord[];
  }>(`/query?q=${encoded}`);

  const records = (result.records ?? []).map((r) => ({
    Id: r.Id,
    Name: r.Name,
    CreatedDate: r.CreatedDate,
    Type__c: r.Type__c,
    Case_No__c: r.Case_No__c,
    Case_Email__c: r.Case_Email__c,
    Stage__c: r.Stage__c,
    Project__c: r.Project__c,
    Website_Detail_Summary__c: r.Website_Detail_Summary__c,
  }));
  const totalSize = result.totalSize ?? records.length;

  cache = { at: now, data: { totalSize, records } };

  return Response.json({
    success: true,
    totalSize,
    records,
    cached: false,
  });
}
