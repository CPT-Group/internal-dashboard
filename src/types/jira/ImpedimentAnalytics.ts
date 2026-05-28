/**
 * Active impediments derived from Jira issue links (Blocks → open operational stories).
 */

export interface ImpedimentBlockedStory {
  key: string;
  summary: string;
  statusName: string;
  projectKey: string;
  techOwnerName: string;
  techOwnerAccountId: string | null;
  assigneeName: string;
}

export interface ImpedimentView {
  key: string;
  summary: string;
  statusName: string;
  projectKey: string;
  assigneeName: string;
  reporterName: string;
  /** Whole days since blocker last updated. */
  ageDays: number;
  blockedStories: ImpedimentBlockedStory[];
}

export interface ImpedimentAnalytics {
  activeImpediments: ImpedimentView[];
  impedimentCount: number;
  impactedStoryCount: number;
}
