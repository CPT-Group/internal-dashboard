import type { CursorBillingSnapshot } from '@/lib/cursorAdminApi';
import type { CursorEnterpriseFetchResult } from '@/lib/cursorAnalyticsEnterpriseApi';

export interface CursorAnalyticsBucket {
  rows: number;
  amount: number;
}

/** Per model for one calendar day (from team CSV `Models Time Series Data`). */
export interface CursorAnalyticsModelDayBreakdown {
  requests: number;
  users: number;
  /** When the export JSON includes token fields, estimates use list input/output $/1M instead of assumed tokens/request. */
  inputTokens?: number;
  outputTokens?: number;
  /** Used when input/output split is absent (blended $/1M). */
  totalTokens?: number;
}

/** ISO day → model slug → request counts (ingested from Analytics Team rollup). */
export type CursorAnalyticsByDayModelRequests = Record<string, Record<string, CursorAnalyticsModelDayBreakdown>>;

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
  /** Optional per-day model request counts from team CSV `Models Time Series Data`. */
  byDayModelRequests?: CursorAnalyticsByDayModelRequests;
  /** Optional map from dedicated "AI edits by repository" export. */
  repoAiEdits?: Record<string, CursorAnalyticsAiEditsMetric>;
  /** Optional map from dedicated "repo x developer" AI edits export. */
  repoDeveloperAiEdits?: Record<string, CursorAnalyticsAiEditsMetric>;
}

/** Dashboard: monetary tables/chart from Admin API vs CSV-derived estimate. */
export type CursorAnalyticsMonetarySource = 'api' | 'csv_estimate';

export type CursorAnalyticsApiResponseBody =
  | {
      loaded: true;
      summary: CursorAnalyticsSummary;
      range: { startDate: string; endDate: string };
      /** Team Admin API: spend, daily usage, usage events (disk-cached). */
      billing?: CursorBillingSnapshot;
      enterprise?: CursorEnterpriseFetchResult;
      /** Non-fatal notices (e.g. billing range clipped for usage events). */
      warnings?: string[];
    }
  | {
      loaded: false;
      summary: null;
      range: { startDate: string; endDate: string };
      billing?: CursorBillingSnapshot;
      enterprise?: CursorEnterpriseFetchResult;
      warnings?: string[];
    };
