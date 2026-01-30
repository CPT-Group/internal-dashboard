import type { JiraIssue } from './JiraIssue';

export interface JiraSearchParams {
  jql: string;
  maxResults?: number;
  startAt?: number;
  fields?: string[];
  expand?: string;
}

export interface JiraSearchResponse {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}
