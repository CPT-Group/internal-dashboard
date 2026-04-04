export type WebsiteHealthStatus = 'ok' | 'warning' | 'error';

export interface WebsiteHealthSiteMapping {
  siteKey: string;
  websiteDbName: string;
  cleanClaimsDbName: string;
}

export interface WebsiteHealthMissingItem {
  submissionId: number;
  dateReceived: string;
  email: string | null;
}

export interface WebsiteHealthSiteResult {
  siteKey: string;
  websiteDbName: string;
  cleanClaimsDbName: string;
  status: WebsiteHealthStatus;
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
  };
}
