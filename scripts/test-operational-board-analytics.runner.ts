/**
 * Fixture tests for Dev Corner board analytics — in-progress, team activity, impediments.
 * Usage: npm run test:operational-board-analytics
 */
import assert from 'node:assert/strict';
import type { JiraIssue } from '@/types';
import { NOVA_CORE_DEVS } from '@/constants/NOVA_TEAM';
import { buildOperationalAnalytics } from '@/utils/operationalAnalytics';
import { buildImpedimentAnalytics } from '@/utils/impedimentAnalytics';
import { getTechOwnerAccountId } from '@/utils/jiraIssueAttribution';
import { JIRA_FLAGGED_IMPEDIMENT_VALUE } from '@/constants';

const ROY_ID = '712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f';
const KYLE_ID = '712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837';
const CM_ASSIGNEE = '712020:99999999-9999-9999-9999-999999999999';

function issue(
  key: string,
  opts: {
    summary?: string;
    statusName?: string;
    statusKey?: string;
    projectKey?: string;
    assigneeId?: string | null;
    assigneeName?: string;
    techOwnerId?: string | null;
    techOwnerName?: string;
    flagged?: boolean;
  } = {}
): JiraIssue {
  const statusKey = opts.statusKey ?? 'indeterminate';
  return {
    id: `id-${key}`,
    self: `https://example.atlassian.net/rest/api/3/issue/${key}`,
    key,
    fields: {
      summary: opts.summary ?? key,
      status: {
        id: '10000',
        name: opts.statusName ?? 'In Dev',
        statusCategory: {
          key: statusKey,
          name: statusKey === 'done' ? 'Done' : 'In Progress',
        },
      },
      project: { id: '10001', key: opts.projectKey ?? 'NOVA', name: 'NOVA' },
      issuetype: { id: '10002', name: 'Task' },
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-05-01T00:00:00.000Z',
      assignee:
        opts.assigneeId === null
          ? null
          : opts.assigneeId
            ? { accountId: opts.assigneeId, displayName: opts.assigneeName ?? 'Dev' }
            : { accountId: ROY_ID, displayName: 'Roy' },
      customfield_10193:
        opts.techOwnerId === null
          ? null
          : opts.techOwnerId
            ? { accountId: opts.techOwnerId, displayName: opts.techOwnerName ?? 'Tech Owner' }
            : null,
      customfield_10021: opts.flagged
        ? [{ id: '10019', value: JIRA_FLAGGED_IMPEDIMENT_VALUE }]
        : [],
    },
  };
}

function buildFromOpen(open: JiraIssue[]) {
  return buildOperationalAnalytics({
    openIssues: open,
    openedTodayIssues: [],
    closedTodayIssues: [],
    landedLast14: [],
    resolvedLast14: [],
  });
}

function assertInProgressInvariants(analytics: ReturnType<typeof buildOperationalAnalytics>): void {
  assert.ok(analytics.inProgressTickets.length <= 20, 'inProgressTickets capped at 20 for TV slide');
  for (const member of analytics.teamActivity) {
    assert.equal(member.inProgressKeys.length, member.inProgressCount);
    assert.equal(member.inProgressSummaries.length, member.inProgressCount);
    assert.equal(member.inProgressIsBug.length, member.inProgressCount);
  }
}

function assertImpedimentInvariants(analytics: ReturnType<typeof buildImpedimentAnalytics>): void {
  assert.equal(analytics.impedimentCount, analytics.activeImpediments.length);
  for (const row of analytics.activeImpediments) {
    assert.ok(row.flagReason.length > 0, `${row.key} must include flag reason text`);
  }
}

// Dev Corner Two in-progress: Tech Owner NOVA + statusCategory indeterminate
{
  const open = [
    issue('NOVA-100', { techOwnerId: ROY_ID, assigneeId: ROY_ID, statusName: 'In Dev' }),
    issue('NOVA-101', { techOwnerId: KYLE_ID, assigneeId: KYLE_ID, statusName: 'QA', statusKey: 'indeterminate' }),
    issue('NOVA-102', { techOwnerId: ROY_ID, assigneeId: CM_ASSIGNEE, assigneeName: 'Case Manager', statusName: 'In Dev' }),
    issue('NOVA-103', { techOwnerId: ROY_ID, statusName: 'To Do', statusKey: 'new' }),
    issue('NOVA-104', { techOwnerId: null, assigneeId: ROY_ID, statusName: 'In Dev' }),
  ];
  const analytics = buildFromOpen(open);
  assert.deepEqual(
    analytics.inProgressTickets.map((t) => t.key).sort(),
    ['NOVA-100', 'NOVA-101', 'NOVA-102', 'NOVA-104'].sort()
  );
  assertInProgressInvariants(analytics);
}

// Dev Corner One team activity: assignee-based in-progress (not Tech Owner)
{
  const open = [
    issue('NOVA-200', { techOwnerId: ROY_ID, assigneeId: KYLE_ID, assigneeName: 'Kyle Dilbeck', statusName: 'In Dev' }),
    issue('NOVA-201', { techOwnerId: KYLE_ID, assigneeId: ROY_ID, assigneeName: 'Roy', statusName: 'In Dev' }),
  ];
  const analytics = buildFromOpen(open);
  const roy = analytics.teamActivity.find((m) => m.accountId === ROY_ID);
  const kyle = analytics.teamActivity.find((m) => m.accountId === KYLE_ID);
  assert.ok(roy);
  assert.ok(kyle);
  assert.deepEqual(roy.inProgressKeys, ['NOVA-201']);
  assert.deepEqual(kyle.inProgressKeys, ['NOVA-200']);
  assertInProgressInvariants(analytics);
}

// Team activity only includes NOVA_CORE_DEVS (Brandon/Carlos excluded from panel)
{
  const analytics = buildFromOpen([]);
  assert.equal(analytics.teamActivity.length, NOVA_CORE_DEVS.length);
  assert.deepEqual(
    analytics.teamActivity.map((m) => m.accountId),
    NOVA_CORE_DEVS.map((m) => m.accountId)
  );
}

// Impediment + operational open cross-check
{
  const open = [
    issue('NOVA-300', { techOwnerId: ROY_ID, techOwnerName: 'Roy' }),
    issue('NOVA-900', { flagged: true }),
  ];
  const carriers = [open[1]].filter((i): i is JiraIssue => i != null);
  const impediments = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: carriers,
  });
  assertImpedimentInvariants(impediments);
  assert.equal(impediments.activeImpediments[0]?.key, 'NOVA-900');
}

// Internal consistency helper used by verify script
{
  const open = [issue('NOVA-400', { techOwnerId: ROY_ID, assigneeId: ROY_ID, statusName: 'In Dev' })];
  const analytics = buildFromOpen(open);
  const techOwnerInProgress = open.filter(
    (i) =>
      i.fields?.status?.statusCategory?.key === 'indeterminate' &&
      getTechOwnerAccountId(i) != null
  );
  assert.ok(analytics.inProgressTickets.length <= techOwnerInProgress.length);
  assertInProgressInvariants(analytics);
}

console.log('test-operational-board-analytics: all assertions passed');
