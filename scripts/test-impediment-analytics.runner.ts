import assert from 'node:assert/strict';
import type { JiraIssue } from '@/types';
import { buildImpedimentAnalytics } from '@/utils/impedimentAnalytics';

function issue(
  key: string,
  opts: {
    summary?: string;
    statusKey?: string;
    projectKey?: string;
    issuelinks?: JiraIssue['fields']['issuelinks'];
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
      issuelinks: opts.issuelinks,
    },
  };
}

function blocksOutward(blockedKey: string): NonNullable<JiraIssue['fields']['issuelinks']>[number] {
  return {
    id: '20001',
    type: { id: '20002', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
    outwardIssue: {
      id: '20003',
      key: blockedKey,
      fields: { summary: blockedKey, status: { id: '10000', name: 'In Dev' } },
    },
  };
}

function blocksInward(blockerKey: string): NonNullable<JiraIssue['fields']['issuelinks']>[number] {
  return {
    id: '20004',
    type: { id: '20002', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
    inwardIssue: {
      id: '20005',
      key: blockerKey,
      fields: { summary: blockerKey, status: { id: '10000', name: 'To Do' } },
    },
  };
}

// Blocker outward link blocks one open operational story
{
  const open = [issue('NOVA-100', { techOwner: 'Roy' })];
  const carriers = [
    issue('NOVA-900', {
      assignee: 'Infra',
      issuelinks: [blocksOutward('NOVA-100')],
    }),
  ];
  const result = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: carriers,
  });
  assert.equal(result.impedimentCount, 1);
  assert.equal(result.activeImpediments[0]?.key, 'NOVA-900');
  assert.equal(result.activeImpediments[0]?.blockedStories[0]?.key, 'NOVA-100');
  assert.equal(result.activeImpediments[0]?.blockedStories[0]?.techOwnerName, 'Roy');
}

// Ignores Done blocked story
{
  const open = [issue('NOVA-101', { statusKey: 'done' })];
  const carriers = [
    issue('NOVA-901', { issuelinks: [blocksOutward('NOVA-101')] }),
  ];
  const result = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: carriers,
  });
  assert.equal(result.impedimentCount, 0);
}

// Inward link on open story points at external blocker (enrichment path)
{
  const open = [
    issue('NOVA-200', {
      techOwner: 'Kyle',
      issuelinks: [blocksInward('IT-50')],
    }),
  ];
  const result = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: [],
    enrichmentIssues: [
      issue('IT-50', { projectKey: 'IT', assignee: 'Ops', issuelinks: [blocksOutward('NOVA-200')] }),
    ],
  });
  assert.equal(result.impedimentCount, 1);
  assert.equal(result.activeImpediments[0]?.key, 'IT-50');
  assert.equal(result.impactedStoryCount, 1);
}

// Dedupes same blocker blocking two stories
{
  const open = [
    issue('NOVA-300'),
    issue('NOVA-301'),
  ];
  const carriers = [
    issue('NOVA-902', {
      issuelinks: [blocksOutward('NOVA-300'), blocksOutward('NOVA-301')],
    }),
  ];
  const result = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: carriers,
  });
  assert.equal(result.impedimentCount, 1);
  assert.equal(result.activeImpediments[0]?.blockedStories.length, 2);
  assert.equal(result.impactedStoryCount, 2);
}

// Non-Blocks link type is ignored
{
  const open = [issue('NOVA-400')];
  const carriers = [
    issue('NOVA-903', {
      issuelinks: [
        {
          id: '20006',
          type: { id: '20007', name: 'Relates', inward: 'relates to', outward: 'relates to' },
          outwardIssue: {
            id: '20008',
            key: 'NOVA-400',
            fields: { summary: 'x', status: { id: '10000', name: 'In Dev' } },
          },
        },
      ],
    }),
  ];
  const result = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: carriers,
  });
  assert.equal(result.impedimentCount, 0);
}

console.log('test-impediment-analytics: all assertions passed');
