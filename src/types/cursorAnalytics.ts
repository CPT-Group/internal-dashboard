import type { CursorBillingSnapshot } from '@/lib/cursorAdminApi';
import type { CursorEnterpriseFetchResult } from '@/lib/cursorAnalyticsEnterpriseApi';

export interface CursorAnalyticsBucket {
  rows: number;
  amount: number;
}

export interface CursorAnalyticsAiEditsMetric {
  rows: number;
  aiLines: number;
  totalLines: number;
  aiPercent: number | null;
}

export interface CursorAnalyticsColumnDetection {
  file: string;
  dateColumn: string | null;
  userColumn: string | null;
  repoColumn: string | null;
  amountColumn: string | null;
}

export interface CursorAnalyticsSummary {
  /** `teamDaily` = Analytics_Team rollup CSV; `tabular` = row-level export; `mixed` / `empty` when combined or no data */
  schema?: string;
  generatedAt: string;
  directory: string;
  sources: string[];
  columnDetection: CursorAnalyticsColumnDetection[];
  byMonth: Record<string, CursorAnalyticsBucket>;
  byRepo: Record<string, CursorAnalyticsBucket>;
  byDeveloper: Record<string, CursorAnalyticsBucket>;
  byMonthRepo: Record<string, CursorAnalyticsBucket>;
  byMonthDeveloper: Record<string, CursorAnalyticsBucket>;
  byRepoDeveloper: Record<string, CursorAnalyticsBucket>;
  /** Daily rollup from CSV (usage-based requests per calendar day when team daily export). */
  byDay: Record<string, CursorAnalyticsBucket>;
  /** Optional map from dedicated "AI edits by repository" export. */
  repoAiEdits?: Record<string, CursorAnalyticsAiEditsMetric>;
  /** Optional map from dedicated "repo x developer" AI edits export. */
  repoDeveloperAiEdits?: Record<string, CursorAnalyticsAiEditsMetric>;
}

export type CursorAnalyticsApiResponseBody =
  | {
      loaded: true;
      summary: CursorAnalyticsSummary;
      range: { startDate: string; endDate: string };
      /** Team Admin API: spend, daily usage, usage events (disk-cached). */
      billing?: CursorBillingSnapshot;
      enterprise?: CursorEnterpriseFetchResult;
    }
  | {
      loaded: false;
      summary: null;
      range: { startDate: string; endDate: string };
      billing?: CursorBillingSnapshot;
      enterprise?: CursorEnterpriseFetchResult;
    };
