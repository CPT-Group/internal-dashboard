import { JIRA_FLAGGED_IMPEDIMENT_VALUE } from '@/constants';
import type { ImpedimentAnalytics, ImpedimentView } from '@/types';
import type { JiraIssue } from '@/types';
import {
  getAssigneeName,
  getReporterName,
} from '@/utils/jiraIssueAttribution';

const FLAGGED_IMPEDIMENT_VALUES = new Set<string>([JIRA_FLAGGED_IMPEDIMENT_VALUE]);

function isDone(issue: JiraIssue): boolean {
  return issue.fields?.status?.statusCategory?.key === 'done';
}

function hasImpedimentFlag(issue: JiraIssue): boolean {
  const flags = issue.fields?.customfield_10021 ?? [];
  return flags.some((flag) => FLAGGED_IMPEDIMENT_VALUES.has(flag.value));
}

function extractFlagReason(issue: JiraIssue): string {
  const flags = issue.fields?.customfield_10021 ?? [];
  const flag = flags.find((entry) => FLAGGED_IMPEDIMENT_VALUES.has(entry.value));
  if (!flag) {
    return 'Impediment';
  }
  return flag.value;
}

function ageDaysFromUpdated(updatedIso: string): number {
  const updatedMs = Date.parse(updatedIso);
  if (!Number.isFinite(updatedMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - updatedMs) / (24 * 60 * 60 * 1000)));
}

function toImpedimentView(blocker: JiraIssue): ImpedimentView {
  return {
    key: blocker.key,
    summary: blocker.fields?.summary ?? '',
    statusName: blocker.fields?.status?.name ?? '—',
    projectKey: blocker.fields?.project?.key ?? '—',
    assigneeName: getAssigneeName(blocker),
    reporterName: getReporterName(blocker),
    flagReason: extractFlagReason(blocker),
    ageDays: ageDaysFromUpdated(blocker.fields?.updated ?? blocker.fields?.created ?? ''),
  };
}

/**
 * Build active impediment rows from open, flagged tickets.
 */
export function buildImpedimentAnalytics(params: {
  openOperationalIssues: JiraIssue[];
  linkCarrierIssues: JiraIssue[];
}): ImpedimentAnalytics {
  const dedupedByKey = new Map<string, JiraIssue>();
  for (const issue of params.linkCarrierIssues) {
    dedupedByKey.set(issue.key, issue);
  }

  const activeImpediments = [...dedupedByKey.values()]
    .filter((issue) => !isDone(issue))
    .filter(hasImpedimentFlag)
    .map(toImpedimentView)
    .sort((a, b) => b.ageDays - a.ageDays);

  return {
    activeImpediments,
    impedimentCount: activeImpediments.length,
  };
}
