/**
 * Active impediments derived from Jira "Flagged" tickets.
 */

export interface ImpedimentView {
  key: string;
  summary: string;
  statusName: string;
  projectKey: string;
  assigneeName: string;
  reporterName: string;
  flagReason: string;
  /** Whole days since blocker last updated. */
  ageDays: number;
}

export interface ImpedimentAnalytics {
  activeImpediments: ImpedimentView[];
  impedimentCount: number;
}
