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
