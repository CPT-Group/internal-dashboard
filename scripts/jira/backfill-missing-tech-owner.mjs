/**
 * Backfill Tech Owner (customfield_10193) on open NOVA sprint tickets where empty.
 *
 * Rules:
 * - assignee is NOVA team → Tech Owner = assignee
 * - otherwise (unassigned / non-NOVA assignee) → Tech Owner = Roy (intake default)
 *
 * Usage:
 *   node scripts/jira/backfill-missing-tech-owner.mjs           # dry-run
 *   node scripts/jira/backfill-missing-tech-owner.mjs --apply   # write to Jira
 */
import fs from 'node:fs';

const apply = process.argv.includes('--apply');

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
const ROY_ID = NOVA_TEAM_IDS[0];

const JQL =
  'project = NOVA AND sprint in openSprints() AND statusCategory != Done AND cf[10193] is EMPTY ORDER BY updated DESC';

const FIELDS = ['summary', 'status', 'assignee', 'customfield_10193', 'issuetype'].join(',');

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
    if (!r.ok) throw new Error(`search ${r.status} ${await r.text()}`);
    const data = await r.json();
    issues.push(...(data.issues ?? []));
    if (data.isLast || !data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }
  return issues;
}

function proposedTechOwnerId(issue) {
  const assigneeId = issue.fields?.assignee?.accountId;
  if (assigneeId && NOVA_TEAM_IDS.includes(assigneeId)) return assigneeId;
  return ROY_ID;
}

function displayNameForId(issue, accountId) {
  if (accountId === ROY_ID) return 'Roy';
  if (issue.fields?.assignee?.accountId === accountId) {
    return issue.fields.assignee.displayName ?? accountId;
  }
  return accountId;
}

async function setTechOwner(issueKey, accountId) {
  const r = await fetch(`${base}/rest/api/3/issue/${issueKey}`, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        customfield_10193: { accountId },
      },
    }),
  });
  if (!r.ok) throw new Error(`${issueKey} PUT ${r.status} ${await r.text()}`);
}

async function main() {
  const issues = await searchAll(JQL);
  console.log(`${apply ? 'APPLY' : 'DRY-RUN'}: ${issues.length} ticket(s) missing Tech Owner\n`);

  let ok = 0;
  let fail = 0;

  for (const issue of issues) {
    const targetId = proposedTechOwnerId(issue);
    const targetName = displayNameForId(issue, targetId);
    const assignee = issue.fields?.assignee?.displayName ?? '(unassigned)';
    const line = `${issue.key} | ${issue.fields?.status?.name} | assignee=${assignee} → Tech Owner=${targetName}`;

    if (!apply) {
      console.log(`  [dry-run] ${line}`);
      ok += 1;
      continue;
    }

    try {
      await setTechOwner(issue.key, targetId);
      console.log(`  [updated] ${line}`);
      ok += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`  [failed]  ${line}`);
      console.error(`            ${error instanceof Error ? error.message : error}`);
      fail += 1;
    }
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed`);
  if (!apply) {
    console.log('Re-run with --apply to write changes to Jira.');
  }
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
