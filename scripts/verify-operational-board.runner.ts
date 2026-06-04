/**
 * Live reconciliation: pull Jira like operationalJiraStore, rebuild analytics, validate invariants.
 * Usage: npm run verify:operational-board
 */
import fs from 'node:fs';
import type { JiraIssue } from '@/types';
import {
  JIRA_IMPEDIMENT_LINK_CARRIERS_JQL,
  JIRA_IMPEDIMENT_SEARCH_FIELDS,
  JIRA_OPERATIONAL_JQL_LIMBO,
  JIRA_OPERATIONAL_JQL_OPEN,
  JIRA_SEARCH_MAX_RESULTS,
} from '@/constants';
import { buildOperationalAnalytics } from '@/utils/operationalAnalytics';
import { buildImpedimentAnalytics } from '@/utils/impedimentAnalytics';
import { NOVA_TEAM_ACCOUNT_IDS } from '@/constants/NOVA_TEAM';
import { getTechOwnerAccountId, getTechOwnerName } from '@/utils/jiraIssueAttribution';
import { filterIssuesNovaMinKey } from '@/utils/jiraNovaFilter';

function loadEnv(): void {
  const text = fs.readFileSync('.env.local', 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const base = (process.env.JIRA_BASE_URL ?? 'https://cptgroup.atlassian.net').replace(/\/$/, '');
const email = process.env.KYLE_EMAIL ?? process.env.JAMES_EMAIL;
const token = process.env.KYLE_JIRA_TOKEN ?? process.env.JAMES_JIRA_TOKEN;
if (!email || !token) {
  console.error('Missing KYLE_EMAIL/KYLE_JIRA_TOKEN (or JAMES_*) in .env.local');
  process.exit(1);
}
const auth = Buffer.from(`${email}:${token}`).toString('base64');

const OPERATIONAL_FIELDS = [
  'summary',
  'status',
  'project',
  'assignee',
  'created',
  'updated',
  'issuetype',
  'priority',
  'duedate',
  'resolutiondate',
  'components',
  'customfield_10193',
  'customfield_10754',
  ...JIRA_IMPEDIMENT_SEARCH_FIELDS,
] as const;

const uniqueFields = [...new Set(OPERATIONAL_FIELDS)];

async function jiraSearch(jql: string, maxResults: number, fields: readonly string[]): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const body: Record<string, unknown> = { jql, maxResults, fields: [...fields] };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const r = await fetch(`${base}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`search/jql ${r.status} ${await r.text()}`);
    const data = (await r.json()) as {
      issues?: JiraIssue[];
      isLast?: boolean;
      nextPageToken?: string;
    };
    issues.push(...(data.issues ?? []));
    if (data.isLast || !data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }
  return issues;
}

function isIndeterminate(issue: JiraIssue): boolean {
  return issue.fields?.status?.statusCategory?.key === 'indeterminate';
}

function isTechOwnerNova(issue: JiraIssue): boolean {
  const id = getTechOwnerAccountId(issue);
  return id != null && NOVA_TEAM_ACCOUNT_IDS.has(id);
}

const failures: string[] = [];
function fail(msg: string): void {
  failures.push(msg);
  console.error(`  FAIL: ${msg}`);
}

async function main(): Promise<void> {
  console.log('Operational board verify (live Jira)\n');

  const [openRaw, limboRaw, linkCarriersRaw] = await Promise.all([
    jiraSearch(JIRA_OPERATIONAL_JQL_OPEN, JIRA_SEARCH_MAX_RESULTS, uniqueFields),
    jiraSearch(JIRA_OPERATIONAL_JQL_LIMBO, JIRA_SEARCH_MAX_RESULTS, uniqueFields),
    jiraSearch(JIRA_IMPEDIMENT_LINK_CARRIERS_JQL, JIRA_SEARCH_MAX_RESULTS, uniqueFields),
  ]);

  const open = filterIssuesNovaMinKey(openRaw);
  const limbo = filterIssuesNovaMinKey(limboRaw);
  const linkCarriers = filterIssuesNovaMinKey(linkCarriersRaw);

  const analytics = buildOperationalAnalytics({
    openIssues: open,
    limboCandidateIssues: limbo,
    openedTodayIssues: [],
    closedTodayIssues: [],
    landedLast14: [],
    resolvedLast14: [],
    transitionDates: new Map(),
  });

  let impedimentDraft = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: linkCarriers,
  });
  const missingBlockerKeys = impedimentDraft.activeImpediments
    .map((row) => row.key)
    .filter(
      (key) => !linkCarriers.some((i) => i.key === key) && !open.some((i) => i.key === key)
    );
  let enrichmentIssues: JiraIssue[] = [];
  if (missingBlockerKeys.length > 0) {
    const enrichJql = `key in (${missingBlockerKeys.join(',')}) ORDER BY updated DESC`;
    enrichmentIssues = filterIssuesNovaMinKey(
      await jiraSearch(enrichJql, missingBlockerKeys.length, uniqueFields)
    );
  }
  const impedimentAnalytics = buildImpedimentAnalytics({
    openOperationalIssues: open,
    linkCarrierIssues: linkCarriers,
    enrichmentIssues,
  });

  const openActive = open.filter((i) => i.fields?.status?.statusCategory?.key !== 'done');
  const totalInProgressTechOwner = openActive.filter(
    (i) => isIndeterminate(i) && isTechOwnerNova(i)
  );

  console.log('=== Summary ===');
  console.log(`Open (board JQL):     ${openActive.length}`);
  console.log(`Limbo KPI:            ${analytics.kpis.limboCount}`);
  console.log(`In progress (TO):     ${totalInProgressTechOwner.length} total | ${analytics.inProgressTickets.length} on Dev 2 slide (max 20)`);
  console.log(`Impediments KPI:      ${impedimentAnalytics.impedimentCount} blockers | ${impedimentAnalytics.impactedStoryCount} stories impacted`);

  console.log('\n=== Dev Corner One — Team Activity (assignee × in progress) ===');
  for (const member of analytics.teamActivity) {
    const keys = member.inProgressKeys.join(', ') || '(none)';
    console.log(`  ${member.displayName}: ${member.inProgressCount}/${member.openCount} open | in progress: ${keys}`);
  }

  console.log('\n=== Dev Corner Two — In Progress cards (Tech Owner × indeterminate) ===');
  if (analytics.inProgressTickets.length === 0) {
    console.log('  (none)');
  }
  for (const t of analytics.inProgressTickets) {
    console.log(`  ${t.key} | ${t.status} | ${t.assignee} | TO via card assignee col | ${t.summary.slice(0, 55)}`);
  }
  if (totalInProgressTechOwner.length > analytics.inProgressTickets.length) {
    console.log(`  … +${totalInProgressTechOwner.length - analytics.inProgressTickets.length} more not shown (20-card cap)`);
  }

  console.log('\n=== Impediments ===');
  if (impedimentAnalytics.activeImpediments.length === 0) {
    console.log('  (none)');
  }
  for (const row of impedimentAnalytics.activeImpediments) {
    const blocked = row.blockedStories.map((s) => s.key).join(', ');
    console.log(`  ${row.key} | ${row.statusName} | ${row.ageDays}d | blocks: ${blocked}`);
  }

  console.log('\n=== Attribution gaps (in progress by Tech Owner, assignee is someone else) ===');
  const gaps = totalInProgressTechOwner.filter((i) => {
    const assigneeId = i.fields?.assignee?.accountId;
    const techId = getTechOwnerAccountId(i);
    return assigneeId != null && techId != null && assigneeId !== techId;
  });
  if (gaps.length === 0) {
    console.log('  (none — Dev 1 assignee chips align with Tech Owner on all in-progress tickets)');
  }
  for (const i of gaps) {
    console.log(
      `  ${i.key} | ${i.fields?.status?.name} | assignee=${i.fields?.assignee?.displayName ?? '?'} | Tech Owner=${getTechOwnerName(i)}`
    );
  }

  console.log('\n=== Invariant checks ===');

  if (impedimentAnalytics.impedimentCount !== impedimentAnalytics.activeImpediments.length) {
    fail('impedimentCount !== activeImpediments.length');
  } else {
    console.log('  OK impedimentCount matches row count');
  }

  for (const ticket of analytics.inProgressTickets) {
    const src = openActive.find((i) => i.key === ticket.key);
    if (!src) {
      fail(`${ticket.key} in inProgressTickets but not in open set`);
      continue;
    }
    if (!isIndeterminate(src)) fail(`${ticket.key} in inProgressTickets but not indeterminate`);
    if (!isTechOwnerNova(src)) fail(`${ticket.key} in inProgressTickets but Tech Owner not NOVA team`);
  }
  if (failures.length === 0) console.log('  OK all inProgressTickets are indeterminate + NOVA Tech Owner');

  for (const member of analytics.teamActivity) {
    for (const key of member.inProgressKeys) {
      const src = openActive.find((i) => i.key === key);
      if (!src) {
        fail(`${key} in teamActivity for ${member.displayName} but not open`);
        continue;
      }
      if (src.fields?.assignee?.accountId !== member.accountId) {
        fail(`${key} listed under ${member.displayName} but assignee differs`);
      }
      if (!isIndeterminate(src)) {
        fail(`${key} in teamActivity in-progress but not indeterminate`);
      }
    }
  }
  if (failures.length === 0) console.log('  OK teamActivity in-progress keys match assignee + indeterminate');

  let blockedStoryOk = true;
  for (const row of impedimentAnalytics.activeImpediments) {
    for (const story of row.blockedStories) {
      if (!openActive.some((i) => i.key === story.key)) {
        fail(`blocked story ${story.key} not in operational open set`);
        blockedStoryOk = false;
      }
    }
  }
  if (blockedStoryOk) console.log('  OK all blocked stories are in operational open scope');

  console.log('');
  if (failures.length > 0) {
    console.error(`${failures.length} invariant failure(s).`);
    process.exit(1);
  }
  console.log('All invariants passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
