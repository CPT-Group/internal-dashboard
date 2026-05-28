import { JIRA_BLOCKS_LINK_TYPE_NAMES } from '@/constants';
import type { ImpedimentAnalytics, ImpedimentBlockedStory, ImpedimentView } from '@/types';
import type { JiraIssue, JiraIssueLink } from '@/types';
import {
  getAssigneeName,
  getReporterName,
  getTechOwnerAccountId,
  getTechOwnerName,
} from '@/utils/jiraIssueAttribution';

const BLOCK_TYPE_NAMES = new Set<string>(JIRA_BLOCKS_LINK_TYPE_NAMES);

function isDone(issue: JiraIssue): boolean {
  return issue.fields?.status?.statusCategory?.key === 'done';
}

function isBlocksLink(link: JiraIssueLink): boolean {
  const name = link.type?.name ?? '';
  return BLOCK_TYPE_NAMES.has(name);
}

function issueMapFromList(issues: JiraIssue[]): Map<string, JiraIssue> {
  const map = new Map<string, JiraIssue>();
  for (const issue of issues) {
    map.set(issue.key, issue);
  }
  return map;
}

function ageDaysFromUpdated(updatedIso: string): number {
  const updatedMs = Date.parse(updatedIso);
  if (!Number.isFinite(updatedMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - updatedMs) / (24 * 60 * 60 * 1000)));
}

function toBlockedStory(issue: JiraIssue): ImpedimentBlockedStory {
  return {
    key: issue.key,
    summary: issue.fields?.summary ?? '',
    statusName: issue.fields?.status?.name ?? '—',
    projectKey: issue.fields?.project?.key ?? '—',
    techOwnerName: getTechOwnerName(issue),
    techOwnerAccountId: getTechOwnerAccountId(issue),
    assigneeName: getAssigneeName(issue),
  };
}

function toImpedimentView(blocker: JiraIssue, blockedKeys: string[], openByKey: Map<string, JiraIssue>): ImpedimentView {
  const blockedStories = blockedKeys
    .map((key) => openByKey.get(key))
    .filter((issue): issue is JiraIssue => issue != null)
    .map(toBlockedStory);

  return {
    key: blocker.key,
    summary: blocker.fields?.summary ?? '',
    statusName: blocker.fields?.status?.name ?? '—',
    projectKey: blocker.fields?.project?.key ?? '—',
    assigneeName: getAssigneeName(blocker),
    reporterName: getReporterName(blocker),
    ageDays: ageDaysFromUpdated(blocker.fields?.updated ?? blocker.fields?.created ?? ''),
    blockedStories,
  };
}

/**
 * Build active impediment rows: open blockers with at least one Blocks link to an open operational story.
 */
export function buildImpedimentAnalytics(params: {
  openOperationalIssues: JiraIssue[];
  linkCarrierIssues: JiraIssue[];
  /** Optional extra issues (e.g. batch key lookup) merged into blocker resolution. */
  enrichmentIssues?: JiraIssue[];
}): ImpedimentAnalytics {
  const openFiltered = params.openOperationalIssues.filter((i) => !isDone(i));
  const openKeys = new Set(openFiltered.map((i) => i.key));
  const openByKey = issueMapFromList(openFiltered);

  const allIssues = [
    ...openFiltered,
    ...params.linkCarrierIssues,
    ...(params.enrichmentIssues ?? []),
  ];
  const byKey = issueMapFromList(allIssues);

  const blockerToBlocked = new Map<string, Set<string>>();

  const addBlock = (blockerKey: string, blockedKey: string) => {
    if (!openKeys.has(blockedKey)) return;
    const blocker = byKey.get(blockerKey);
    if (!blocker || isDone(blocker)) return;
    let set = blockerToBlocked.get(blockerKey);
    if (!set) {
      set = new Set();
      blockerToBlocked.set(blockerKey, set);
    }
    set.add(blockedKey);
  };

  for (const carrier of params.linkCarrierIssues) {
    if (isDone(carrier)) continue;
    for (const link of carrier.fields?.issuelinks ?? []) {
      if (!isBlocksLink(link)) continue;
      const blockedKey = link.outwardIssue?.key;
      if (blockedKey) addBlock(carrier.key, blockedKey);
    }
  }

  for (const open of openFiltered) {
    for (const link of open.fields?.issuelinks ?? []) {
      if (!isBlocksLink(link)) continue;
      const blockerKey = link.inwardIssue?.key;
      if (blockerKey) addBlock(blockerKey, open.key);
    }
  }

  const activeImpediments: ImpedimentView[] = [...blockerToBlocked.entries()]
    .map(([blockerKey, blockedSet]) => {
      const blocker = byKey.get(blockerKey);
      if (!blocker) return null;
      return toImpedimentView(blocker, [...blockedSet], openByKey);
    })
    .filter((row): row is ImpedimentView => row != null)
    .sort((a, b) => b.ageDays - a.ageDays);

  const impactedStoryCount = new Set(
    activeImpediments.flatMap((row) => row.blockedStories.map((s) => s.key))
  ).size;

  return {
    activeImpediments,
    impedimentCount: activeImpediments.length,
    impactedStoryCount,
  };
}
