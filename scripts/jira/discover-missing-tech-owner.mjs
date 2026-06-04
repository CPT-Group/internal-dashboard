/**
 * Discover open NOVA sprint tickets missing Tech Owner (customfield_10193).
 * Usage: node scripts/jira/discover-missing-tech-owner.mjs
 */
import fs from 'node:fs';

const envText = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const l = envText.split(/\r?\n/).find((x) => x.startsWith(`${k}=`));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
};

const base = (get('JIRA_BASE_URL') || 'https://cptgroup.atlassian.net').replace(/\/$/, '');
const email = get('KYLE_EMAIL') || get('JAMES_EMAIL');
const token = get('KYLE_JIRA_TOKEN') || get('JAMES_JIRA_TOKEN');
const auth = Buffer.from(`${email}:${token}`).toString('base64');

const NOVA_TEAM_IDS = [
  '712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f',
  '712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837',
  '712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef',
  '712020:384111d1-8f9d-4155-8420-37ff1888d6c3',
  '712020:47cb6286-8794-44bf-bcb8-6ca1b6aadb79',
];
const NOVA_IN = NOVA_TEAM_IDS.map((id) => `"${id}"`).join(', ');
const ROY_ID = NOVA_TEAM_IDS[0];

const FIELDS = [
  'summary',
  'status',
  'assignee',
  'customfield_10193',
  'issuetype',
  'customfield_10754',
].join(',');

async function searchAll(jql) {
  const issues = [];
  let nextPageToken;
  for (let page = 0; page < 20; page++) {
    const body = { jql, maxResults: 100, fields: FIELDS.split(',') };
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
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const data = await r.json();
    issues.push(...(data.issues ?? []));
    if (data.isLast || !data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }
  return issues;
}

function isNovaAssignee(issue) {
  const id = issue.fields?.assignee?.accountId;
  return id != null && NOVA_TEAM_IDS.includes(id);
}

function proposedTechOwnerId(issue) {
  const assigneeId = issue.fields?.assignee?.accountId;
  if (assigneeId && NOVA_TEAM_IDS.includes(assigneeId)) return assigneeId;
  return ROY_ID;
}

const queries = {
  kanbanOpenMissingTo:
    `project = NOVA AND sprint in openSprints() AND statusCategory != Done AND cf[10193] is EMPTY ORDER BY updated DESC`,
  operationalOpenMissingTo:
    `project = NOVA AND sprint in openSprints() AND assignee IN (${NOVA_IN}) AND statusCategory != Done AND cf[10193] is EMPTY ORDER BY updated DESC`,
  kanbanOpenNonNovaAssignee:
    `project = NOVA AND sprint in openSprints() AND statusCategory != Done AND assignee NOT IN (${NOVA_IN}) AND assignee is not EMPTY ORDER BY updated DESC`,
  kanbanOpenUnassigned:
    `project = NOVA AND sprint in openSprints() AND statusCategory != Done AND assignee is EMPTY ORDER BY updated DESC`,
};

async function main() {
  console.log('Tech Owner discovery (NOVA sprint board)\n');

  for (const [label, jql] of Object.entries(queries)) {
    const issues = await searchAll(jql);
    console.log(`=== ${label} (${issues.length}) ===`);
    for (const issue of issues.slice(0, 25)) {
      const assignee = issue.fields?.assignee?.displayName ?? '(unassigned)';
      const status = issue.fields?.status?.name ?? '?';
      const type = issue.fields?.issuetype?.name ?? '?';
      const proposed = proposedTechOwnerId(issue);
      const proposedName =
        proposed === ROY_ID ? 'Roy' : issue.fields?.assignee?.displayName ?? 'Roy';
      console.log(
        `  ${issue.key} | ${status} | ${type} | assignee=${assignee} | → Tech Owner=${proposedName}`
      );
    }
    if (issues.length > 25) console.log(`  ... +${issues.length - 25} more`);
    console.log('');
  }

  const missing = await searchAll(queries.kanbanOpenMissingTo);
  const byAssigneeKind = {
    novaAssignee: missing.filter(isNovaAssignee).length,
    nonNovaAssignee: missing.filter((i) => i.fields?.assignee && !isNovaAssignee(i)).length,
    unassigned: missing.filter((i) => !i.fields?.assignee).length,
  };
  console.log('=== Summary: missing Tech Owner on NOVA sprint open ===');
  console.log(`Total: ${missing.length}`);
  console.log(`  Nova assignee (copy assignee → Tech Owner): ${byAssigneeKind.novaAssignee}`);
  console.log(`  Non-NOVA assignee (default → Roy): ${byAssigneeKind.nonNovaAssignee}`);
  console.log(`  Unassigned (default → Roy): ${byAssigneeKind.unassigned}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
