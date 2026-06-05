import assert from 'node:assert/strict';
import type { JiraIssue } from '@/types';
import { buildImpedimentAnalytics } from '@/utils/impedimentAnalytics';
import { JIRA_FLAGGED_IMPEDIMENT_VALUE } from '@/constants';

function issue(
  key: string,
  opts: {
    summary?: string;
    statusKey?: string;
    projectKey?: string;
    flagged?: boolean;
    techOwner?: string;
    assignee?: string;
  } = {}
): JiraIssue {
  const done = opts.statusKey === 'done';
  return {
    id: `id-${key}`,
    self: `https://example.atlassian.net/rest/api/3/issue/${key}`,
    key,
    fields: {
      summary: opts.summary ?? key,
      status: {
        id: '10000',
        name: done ? 'Done' : 'In Dev',
        statusCategory: { key: opts.statusKey ?? 'indeterminate', name: done ? 'Done' : 'In Progress' },
      },
      project: { id: '10001', key: opts.projectKey ?? 'NOVA', name: 'NOVA' },
      issuetype: { id: '10002', name: 'Task' },
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-05-01T00:00:00.000Z',
      assignee: opts.assignee
        ? { accountId: 'a1', displayName: opts.assignee }
        : null,
      customfield_10193: opts.techOwner
        ? { accountId: 't1', displayName: opts.techOwner }
        : null,
      customfield_10021: opts.flagged
        ? [{ id: '10019', value: JIRA_FLAGGED_IMPEDIMENT_VALUE }]
        : [],
    },
  };
}

// Open and flagged in board scope appears as impediment
{
  const open = [issue('NOVA-100', { techOwner: 'Roy' })];
  const carriers = [
    issue('NOVA-900', {
      assignee: 'Infra',
      flagged: true,
    }),
  ];
  const result = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: carriers,
  });
  assert.equal(result.impedimentCount, 1);
  assert.equal(result.activeImpediments[0]?.key, 'NOVA-900');
  assert.equal(result.activeImpediments[0]?.flagReason, JIRA_FLAGGED_IMPEDIMENT_VALUE);
}

// Ignores done flagged ticket
{
  const open = [issue('NOVA-101', { statusKey: 'done' })];
  const carriers = [
    issue('NOVA-901', { statusKey: 'done', flagged: true }),
  ];
  const result = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: carriers,
  });
  assert.equal(result.impedimentCount, 0);
}

// Flagged carrier in another project displays
{
  const open = [issue('NOVA-200', { techOwner: 'Kyle' })];
  const carriers = [issue('IT-50', { projectKey: 'IT', flagged: true })];
  const result = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: carriers,
  });
  assert.equal(result.impedimentCount, 1);
  assert.equal(result.activeImpediments[0]?.key, 'IT-50');
}

// Non-flagged carrier is ignored
{
  const open = [issue('NOVA-300')];
  const carriers = [
    issue('NOVA-902', {
      flagged: false,
    }),
  ];
  const result = buildImpedimentAnalytics({
    openOperationalIssues: [open[0], carriers[0]].filter((i): i is JiraIssue => i != null),
    linkCarrierIssues: carriers,
  });
  assert.equal(result.impedimentCount, 0);
}

console.log('test-impediment-analytics: all assertions passed');
