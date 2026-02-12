/**
 * Minimal Jira issue shape for dashboard (REST API v3 search response).
 * Full issue has many more fields; we type what we use.
 */

export interface JiraIssueStatus {
  id: string;
  name: string;
  statusCategory?: {
    key: string;
    name: string;
  };
}

export interface JiraIssueProject {
  key: string;
  id: string;
  name: string;
}

export interface JiraUser {
  accountId: string;
  displayName?: string;
  emailAddress?: string;
}

export interface JiraIssueFields {
  summary: string;
  status: JiraIssueStatus;
  project: JiraIssueProject;
  assignee: JiraUser | null;
  created: string;
  updated: string;
  issuetype: {
    id: string;
    name: string;
  };
  priority?: {
    id: string;
    name: string;
  };
  /** ISO date string; used for overdue (late) tickets. */
  duedate?: string | null;
  /** When the issue was resolved (done). ISO datetime. */
  resolutiondate?: string | null;
  /** Jira components (e.g. Backend, Frontend). */
  components?: Array<{ id: string; name: string }> | null;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}
