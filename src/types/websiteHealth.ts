export type WebsiteHealthStatus = 'ok' | 'warning' | 'error';
export type WebsiteHealthWebDbStatus = 'ok' | 'error';

export interface WebsiteHealthSiteMapping {
  siteKey: string;
  websiteDbName: string;
  cleanClaimsDbName: string;
  deadlineDate?: string | null;
}

export interface WebsiteHealthMissingItem {
  submissionId: number;
  dateReceived: string;
  email: string | null;
}

/** Rows on the website Submissions side that fail Web DB integrity checks (in-scope only). */
export interface WebsiteHealthWebDbIssueItem {
  submissionId: number;
  /** ISO timestamp when set; null when `DateReceived` is missing in the website DB. */
  dateReceived: string | null;
  email: string | null;
  confirmationNo: string | null;
  reasons: string[];
}

export interface WebsiteHealthSiteResult {
  siteKey: string;
  websiteDbName: string;
  cleanClaimsDbName: string;
  deadlineDate?: string | null;
  status: WebsiteHealthStatus;
  webDbStatus: WebsiteHealthWebDbStatus;
  webDbIssueCount: number;
  webDbMissingDateReceivedCount: number;
  webDbMissingConfirmationCount: number;
  webDbNotSubmittedCount: number;
  submittedOnlineCount: number;
  matchedInCleanClaimsCount: number;
  missingCount: number;
  errorMessage?: string;
}

export interface WebsiteHealthSummary {
  runAt: string;
  sinceDays: number | null;
  activeSitesLoadedAt: string | null;
  activeSitesSource: 'cache' | 'database' | 'fallback';
  activeSitesStale: boolean;
  totalSitesChecked: number;
  sitesWithIssues: number;
  totalSubmittedOnline: number;
  totalMatchedInCleanClaims: number;
  totalMissingInCleanClaims: number;
  results: WebsiteHealthSiteResult[];
}

export interface WebsiteHealthSummaryResponse {
  ok: boolean;
  summary: WebsiteHealthSummary;
  alerted: boolean;
  alertMessage?: string;
}

export interface WebsiteHealthSiteDetailsResponse {
  ok: boolean;
  site: WebsiteHealthSiteResult & {
    missingItems: WebsiteHealthMissingItem[];
    webDbIssueItems: WebsiteHealthWebDbIssueItem[];
  };
}

export interface WebsiteHealthCreateJiraTicketRequest {
  site: WebsiteHealthSiteResult;
  sinceDays: number | null;
  runAt: string;
  missingItems: WebsiteHealthMissingItem[];
  webDbIssueItems: WebsiteHealthWebDbIssueItem[];
}

export interface WebsiteHealthCreateJiraTicketResponse {
  ok: boolean;
  issueKey: string;
  issueUrl: string;
}

export interface WebsiteHealthSubmissionReportSiteResult {
  siteKey: string;
  websiteDbName: string;
  status: WebsiteHealthStatus;
  totalSubmittedCount: number;
  submittedTodayCount: number;
  submittedYesterdayCount: number;
  errorMessage?: string;
}

export interface WebsiteHealthSubmissionReport {
  runAt: string;
  activeSitesLoadedAt: string | null;
  activeSitesSource: 'cache' | 'database' | 'fallback';
  activeSitesStale: boolean;
  totalSitesChecked: number;
  totalSubmittedCount: number;
  totalSubmittedTodayCount: number;
  totalSubmittedYesterdayCount: number;
  results: WebsiteHealthSubmissionReportSiteResult[];
}

export interface WebsiteHealthSubmissionReportResponse {
  ok: boolean;
  report: WebsiteHealthSubmissionReport;
  alerted: boolean;
  alertMessage?: string;
}

export interface WebsiteHealthDailyReportSiteResult {
  siteKey: string;
  cleanClaimsDbName: string;
  status: WebsiteHealthStatus;
  deficientTrueCount: number;
  disputedTrueCount: number;
  errorMessage?: string;
}

export interface WebsiteHealthDailyReport {
  runAt: string;
  activeSitesLoadedAt: string | null;
  activeSitesSource: 'cache' | 'database' | 'fallback';
  activeSitesStale: boolean;
  totalSitesChecked: number;
  totalDeficientTrueCount: number;
  totalDisputedTrueCount: number;
  results: WebsiteHealthDailyReportSiteResult[];
}

export interface WebsiteHealthDailyReportResponse {
  ok: boolean;
  report: WebsiteHealthDailyReport;
  alerted: boolean;
  alertMessage?: string;
}

/**
 * Report-by-date scoping — the downloader runs at 05:15 every day, so a "day" D
 * actually covers `[D 05:15:00, D+1 05:15:00)` in SQL-server local time.
 */
export type WebsiteHealthReportByDateKind = 'submission' | 'daily';

export interface WebsiteHealthReportByDateWindow {
  /** YYYY-MM-DD inclusive start date (day whose 05:15 AM kicks the window off). */
  startDate: string;
  /** YYYY-MM-DD inclusive end date (window closes at `endDate + 1 @ 05:15`). */
  endDate: string;
  /** ISO timestamp for the window lower bound — `startDate` at 05:15 local. */
  startDateTime: string;
  /** ISO timestamp for the window upper bound (exclusive) — `endDate + 1` at 05:15 local. */
  endDateTimeExclusive: string;
}

export interface WebsiteHealthSubmissionByDateSiteResult {
  siteKey: string;
  websiteDbName: string;
  status: WebsiteHealthStatus;
  /** Total submissions with `DateReceived` inside the 5:15-anchored window. */
  windowSubmittedCount: number;
  errorMessage?: string;
}

export interface WebsiteHealthSubmissionByDateReport {
  runAt: string;
  window: WebsiteHealthReportByDateWindow;
  activeSitesLoadedAt: string | null;
  activeSitesSource: 'cache' | 'database' | 'fallback';
  activeSitesStale: boolean;
  totalSitesChecked: number;
  totalWindowSubmittedCount: number;
  results: WebsiteHealthSubmissionByDateSiteResult[];
}

export interface WebsiteHealthDailyByDateSiteResult {
  siteKey: string;
  cleanClaimsDbName: string;
  status: WebsiteHealthStatus;
  /** Column name used to filter CleanClaims by date (e.g. `DateReceived`, `DateAdded`). */
  dateColumnUsed: string | null;
  windowDeficientTrueCount: number;
  windowDisputedTrueCount: number;
  errorMessage?: string;
}

export interface WebsiteHealthDailyByDateReport {
  runAt: string;
  window: WebsiteHealthReportByDateWindow;
  activeSitesLoadedAt: string | null;
  activeSitesSource: 'cache' | 'database' | 'fallback';
  activeSitesStale: boolean;
  totalSitesChecked: number;
  totalWindowDeficientTrueCount: number;
  totalWindowDisputedTrueCount: number;
  results: WebsiteHealthDailyByDateSiteResult[];
}

export interface WebsiteHealthReportByDateResponse {
  ok: boolean;
  window: WebsiteHealthReportByDateWindow;
  submission: WebsiteHealthSubmissionByDateReport | null;
  daily: WebsiteHealthDailyByDateReport | null;
  alerted: boolean;
  alertMessage?: string;
}
