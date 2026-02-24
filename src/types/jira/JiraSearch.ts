import type { JiraIssue } from './JiraIssue';

export interface JiraSearchParams {
  jql: string;
  maxResults?: number;
  fields?: string[];
  expand?: string;
  /** Cursor token for v3 pagination; omit for first page. */
  nextPageToken?: string;
}

/** Shape returned by Jira v3 POST /search/jql (cursor-based). */
export interface JiraSearchV3Raw {
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast: boolean;
}

/** Our normalized response (aggregated from potentially multiple pages). */
export interface JiraSearchResponse {
  total: number;
  issues: JiraIssue[];
}
