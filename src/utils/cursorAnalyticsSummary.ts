import type {
  CursorAnalyticsAiEditsMetric,
  CursorAnalyticsBucket,
  CursorAnalyticsByDayModelRequests,
  CursorAnalyticsColumnDetection,
  CursorAnalyticsModelDayBreakdown,
  CursorAnalyticsSummary,
} from '@/types/cursorAnalytics';

function isBucket(value: object): value is CursorAnalyticsBucket {
  const b = value as CursorAnalyticsBucket;
  return typeof b.rows === 'number' && typeof b.amount === 'number';
}

function isBucketMap(value: unknown): value is Record<string, CursorAnalyticsBucket> {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, object>;
  return Object.values(o).every((v) => typeof v === 'object' && v !== null && isBucket(v));
}

function isAiEditsMetric(value: object): value is CursorAnalyticsAiEditsMetric {
  const m = value as CursorAnalyticsAiEditsMetric;
  return (
    typeof m.rows === 'number' &&
    typeof m.aiLines === 'number' &&
    typeof m.totalLines === 'number' &&
    (m.aiPercent === null || typeof m.aiPercent === 'number')
  );
}

function isAiEditsMetricMap(value: unknown): value is Record<string, CursorAnalyticsAiEditsMetric> {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, object>;
  return Object.values(o).every((v) => typeof v === 'object' && v !== null && isAiEditsMetric(v));
}

function isModelDayBreakdown(value: object): value is CursorAnalyticsModelDayBreakdown {
  const m = value as CursorAnalyticsModelDayBreakdown;
  if (typeof m.requests !== 'number' || typeof m.users !== 'number') return false;
  const optNum = (x: unknown): boolean => x === undefined || (typeof x === 'number' && Number.isFinite(x) && x >= 0);
  return optNum(m.inputTokens) && optNum(m.outputTokens) && optNum(m.totalTokens);
}

function isByDayModelRequestsMap(value: unknown): value is CursorAnalyticsByDayModelRequests {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, Record<string, object>>;
  for (const inner of Object.values(o)) {
    if (!inner || typeof inner !== 'object') return false;
    for (const v of Object.values(inner)) {
      if (!v || typeof v !== 'object' || !isModelDayBreakdown(v)) return false;
    }
  }
  return true;
}

function isColumnDetection(value: object): value is CursorAnalyticsColumnDetection {
  const c = value as CursorAnalyticsColumnDetection;
  return (
    typeof c.file === 'string' &&
    (c.dateColumn === null || typeof c.dateColumn === 'string') &&
    (c.userColumn === null || typeof c.userColumn === 'string') &&
    (c.repoColumn === null || typeof c.repoColumn === 'string') &&
    (c.amountColumn === null || typeof c.amountColumn === 'string')
  );
}

/** Narrow JSON read from disk into `CursorAnalyticsSummary`, or `null` if invalid. */
export function parseCursorAnalyticsSummary(raw: unknown): CursorAnalyticsSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.generatedAt !== 'string' || typeof o.directory !== 'string') return null;
  if (!Array.isArray(o.sources) || !o.sources.every((s) => typeof s === 'string')) return null;
  if (!Array.isArray(o.columnDetection) || !o.columnDetection.every((c) => typeof c === 'object' && c !== null && isColumnDetection(c as object)))
    return null;
  if (o.schema !== undefined && typeof o.schema !== 'string') return null;
  if (!isBucketMap(o.byMonth)) return null;
  if (!isBucketMap(o.byRepo)) return null;
  if (!isBucketMap(o.byDeveloper)) return null;
  if (!isBucketMap(o.byMonthRepo)) return null;
  if (!isBucketMap(o.byMonthDeveloper)) return null;
  if (!isBucketMap(o.byRepoDeveloper)) return null;
  const byDay = o.byDay !== undefined ? (isBucketMap(o.byDay) ? o.byDay : null) : {};
  if (byDay === null) return null;
  const repoAiEdits =
    o.repoAiEdits !== undefined ? (isAiEditsMetricMap(o.repoAiEdits) ? o.repoAiEdits : null) : undefined;
  if (repoAiEdits === null) return null;
  const repoDeveloperAiEdits =
    o.repoDeveloperAiEdits !== undefined
      ? (isAiEditsMetricMap(o.repoDeveloperAiEdits) ? o.repoDeveloperAiEdits : null)
      : undefined;
  if (repoDeveloperAiEdits === null) return null;

  const byDayModelRequests =
    o.byDayModelRequests !== undefined
      ? isByDayModelRequestsMap(o.byDayModelRequests)
        ? o.byDayModelRequests
        : null
      : undefined;
  if (byDayModelRequests === null) return null;

  return {
    schema: typeof o.schema === 'string' ? o.schema : undefined,
    generatedAt: o.generatedAt,
    directory: o.directory,
    sources: o.sources,
    columnDetection: o.columnDetection as CursorAnalyticsColumnDetection[],
    byMonth: o.byMonth,
    byRepo: o.byRepo,
    byDeveloper: o.byDeveloper,
    byMonthRepo: o.byMonthRepo,
    byMonthDeveloper: o.byMonthDeveloper,
    byRepoDeveloper: o.byRepoDeveloper,
    byDay,
    byDayModelRequests,
    repoAiEdits,
    repoDeveloperAiEdits,
  };
}
