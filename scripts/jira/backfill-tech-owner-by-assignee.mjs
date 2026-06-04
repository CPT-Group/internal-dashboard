/**
 * Set Tech Owner (customfield_10193) from assignee rules — empty Tech Owner only.
 *
 * Rules (assignee → Tech Owner):
 *   Roy or Brandon → Roy
 *   Kyle           → Kyle
 *   James          → Roy
 *
 * Usage:
 *   node scripts/jira/backfill-tech-owner-by-assignee.mjs           # dry-run
 *   node scripts/jira/backfill-tech-owner-by-assignee.mjs --apply   # write to Jira
 */
import fs from 'node:fs';

const apply = process.argv.includes('--apply');

const ROY_ID = '712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f';
const KYLE_ID = '712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837';
const JAMES_ID = '712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef';
const BRANDON_ID = '712020:384111d1-8f9d-4155-8420-37ff1888d6c3';

const TARGET_ASSIGNEES = [
  { id: ROY_ID, label: 'Roy' },
  { id: KYLE_ID, label: 'Kyle Dilbeck' },
  { id: JAMES_ID, label: 'James Cassidy' },
  { id: BRANDON_ID, label: 'Brandon Fay' },
];

const TECH_OWNER_LABEL = { [ROY_ID]: 'Roy', [KYLE_ID]: 'Kyle Dilbeck' };

const envText = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const l = envText.split(/\r?\n/).find((x) => x.startsWith(`${k}=`));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
};

const base = (get('JIRA_BASE_URL') || 'https://cptgroup.atlassian.net').replace(/\/$/, '');
const email = get('KYLE_EMAIL') || get('JAMES_EMAIL');
const token = get('KYLE_JIRA_TOKEN') || get('JAMES_JIRA_TOKEN');
const auth = Buffer.from(`${email}:${token}`).toString('base64');

const ASSIGNEE_IN = TARGET_ASSIGNEES.map((d) => `"${d.id}"`).join(', ');
const JQL = `assignee IN (${ASSIGNEE_IN}) AND cf[10193] is EMPTY ORDER BY updated DESC`;

const FIELDS = ['summary', 'status', 'assignee', 'customfield_10193', 'project', 'issuetype'].join(',');

function proposedTechOwnerId(issue) {
  const assigneeId = issue.fields?.assignee?.accountId;
  if (!assigneeId) return null;
  if (assigneeId === ROY_ID || assigneeId === BRANDON_ID || assigneeId === JAMES_ID) {
    return ROY_ID;
  }
  if (assigneeId === KYLE_ID) {
    return KYLE_ID;
  }
  return null;
}

async function searchAll(jql) {
  const issues = [];
  let nextPageToken;
  for (let page = 0; page < 50; page++) {
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
  const actionable = issues.filter((issue) => {
    if (issue.fields?.customfield_10193) return false;
    return proposedTechOwnerId(issue) != null;
  });

  console.log(
    `${apply ? 'APPLY' : 'DRY-RUN'}: ${actionable.length} ticket(s) with empty Tech Owner (of ${issues.length} assignee match)\n`
  );

  let ok = 0;
  let fail = 0;
  let skipped = 0;

  for (const issue of issues) {
    if (issue.fields?.customfield_10193) {
      skipped += 1;
      continue;
    }

    const targetId = proposedTechOwnerId(issue);
    if (!targetId) continue;

    const assignee = issue.fields?.assignee?.displayName ?? '(unassigned)';
    const project = issue.fields?.project?.key ?? '?';
    const targetName = TECH_OWNER_LABEL[targetId] ?? targetId;
    const line = `${issue.key} (${project}) | ${issue.fields?.status?.name} | assignee=${assignee} → Tech Owner=${targetName}`;

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

  console.log(`\nDone: ${ok} ${apply ? 'updated' : 'would update'}, ${fail} failed, ${skipped} skipped (already had Tech Owner)`);
  if (!apply) {
    console.log('Re-run with --apply to write changes to Jira.');
  }
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
