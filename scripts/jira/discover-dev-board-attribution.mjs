/**
 * Compare per-dev assignee vs Tech Owner counts on NOVA sprint open board.
 * Usage: node scripts/jira/discover-dev-board-attribution.mjs [firstName]
 */
import fs from 'node:fs';

const devFilter = (process.argv[2] ?? 'Roy').toLowerCase();

const envText = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const l = envText.split(/\r?\n/).find((x) => x.startsWith(`${k}=`));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
};

const base = (get('JIRA_BASE_URL') || 'https://cptgroup.atlassian.net').replace(/\/$/, '');
const email = get('KYLE_EMAIL') || get('JAMES_EMAIL');
const token = get('KYLE_JIRA_TOKEN') || get('JAMES_JIRA_TOKEN');
const auth = Buffer.from(`${email}:${token}`).toString('base64');

const DEVS = [
  { id: '712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f', name: 'Roy' },
  { id: '712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837', name: 'Kyle Dilbeck' },
  { id: '712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef', name: 'James Cassidy' },
];

const DEV = DEVS.find((d) => d.name.toLowerCase().startsWith(devFilter));
if (!DEV) {
  console.error('Unknown dev filter:', devFilter);
  process.exit(1);
}

const FIELDS = ['summary', 'status', 'assignee', 'customfield_10193', 'issuetype'].join(',');

const DEV_RESPONSIBLE_NOVA = new Set(['To Do', 'In Dev', 'Dev Review', 'QA']);

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

function techOwnerId(issue) {
  return issue.fields?.customfield_10193?.accountId ?? issue.fields?.assignee?.accountId ?? null;
}

function isInProgress(issue) {
  return issue.fields?.status?.statusCategory?.key === 'indeterminate';
}

function isDevResponsible(issue) {
  const status = issue.fields?.status?.name ?? '';
  return DEV_RESPONSIBLE_NOVA.has(status);
}

async function main() {
  const jql = `project = NOVA AND sprint in openSprints() AND statusCategory != Done ORDER BY updated DESC`;
  const all = await searchAll(jql);

  const byAssignee = all.filter((i) => i.fields?.assignee?.accountId === DEV.id);
  const byTechOwner = all.filter((i) => techOwnerId(i) === DEV.id);

  const assigneeInProgress = byAssignee.filter(isInProgress);
  const assigneeOpen = byAssignee.filter(isDevResponsible);
  const techInProgress = byTechOwner.filter(isInProgress);
  const techOpen = byTechOwner.filter(isDevResponsible);

  console.log(`\n${DEV.name} — NOVA sprint open (${all.length} total on board)\n`);
  console.log('Dashboard Team Activity today uses ASSIGNEE:');
  console.log(`  inProgress: ${assigneeInProgress.length} | open (dev-responsible): ${assigneeOpen.length}`);
  console.log('If switched to TECH OWNER (+ assignee fallback when empty):');
  console.log(`  inProgress: ${techInProgress.length} | open (dev-responsible): ${techOpen.length}`);

  console.log('\n--- By assignee (in progress) ---');
  for (const i of assigneeInProgress) {
    const to = i.fields?.customfield_10193?.displayName ?? '(empty)';
    console.log(`  ${i.key} | ${i.fields?.status?.name} | Tech Owner=${to} | ${i.fields?.summary?.slice(0, 60)}`);
  }

  console.log('\n--- By tech owner, not assignee (would gain with TO attribution) ---');
  for (const i of byTechOwner.filter((x) => x.fields?.assignee?.accountId !== DEV.id)) {
    console.log(
      `  ${i.key} | ${i.fields?.status?.name} | assignee=${i.fields?.assignee?.displayName ?? '(none)'} | ${i.fields?.summary?.slice(0, 60)}`
    );
  }

  console.log('\n--- Missing Tech Owner but assignee matches ---');
  for (const i of byAssignee.filter((x) => !x.fields?.customfield_10193)) {
    console.log(`  ${i.key} | ${i.fields?.status?.name} | ${i.fields?.summary?.slice(0, 60)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
