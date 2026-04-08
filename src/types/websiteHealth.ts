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
  dateReceived: string;
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
