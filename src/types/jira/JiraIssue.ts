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

export interface JiraIssueLinkType {
  id: string;
  name: string;
  inward: string;
  outward: string;
}

/** Minimal linked issue embedded on issuelinks from Jira search. */
export interface JiraLinkedIssueRef {
  id: string;
  key: string;
  fields?: {
    summary?: string;
    status?: JiraIssueStatus;
    project?: JiraIssueProject;
    assignee?: JiraUser | null;
    customfield_10193?: JiraUser | null;
  };
}

export interface JiraIssueLink {
  id: string;
  type: JiraIssueLinkType;
  outwardIssue?: JiraLinkedIssueRef | null;
  inwardIssue?: JiraLinkedIssueRef | null;
}

export interface JiraFlagOption {
  id: string;
  value: string;
  self?: string;
}

export interface JiraIssueFields {
  summary: string;
  status: JiraIssueStatus;
  project: JiraIssueProject;
  assignee: JiraUser | null;
  reporter?: JiraUser | null;
  created: string;
  updated: string;
  issuelinks?: JiraIssueLink[];
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
  /** Tech Owner – the dev who actually does the work (customfield_10193). */
  customfield_10193?: JiraUser | null;
  /** Jira flag field ("Flagged"), used for impediment tracking. */
  customfield_10021?: JiraFlagOption[] | null;
  /** NOVA project — "NOVA Components" single-select (customfield_10754). */
  customfield_10754?: { value?: string; id?: string; self?: string } | null;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}
