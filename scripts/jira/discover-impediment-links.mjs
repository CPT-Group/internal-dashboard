/**
 * Sample issuelinks on open operational / NOVA sprint issues.
 * Usage: node scripts/jira/discover-impediment-links.mjs
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

const FIELDS = [
  'summary',
  'status',
  'project',
  'assignee',
  'issuelinks',
  'issuetype',
].join(',');

async function search(jql, max = 15) {
  const r = await fetch(`${base}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jql, maxResults: max, fields: FIELDS.split(',') }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

const jqlOpenNova =
  'project = NOVA AND sprint in openSprints() AND statusCategory != Done ORDER BY updated DESC';
const issues = (await search(jqlOpenNova, 20)).issues ?? [];

const linkTypes = new Map();
let withLinks = 0;

for (const issue of issues) {
  const links = issue.fields?.issuelinks ?? [];
  if (links.length === 0) continue;
  withLinks += 1;
  console.log(`\n${issue.key} (${issue.fields?.status?.name}) — ${links.length} link(s)`);
  for (const link of links) {
    const typeName = link.type?.name ?? '?';
    const inward = link.type?.inward ?? '';
    const outward = link.type?.outward ?? '';
    linkTypes.set(typeName, { inward, outward, count: (linkTypes.get(typeName)?.count ?? 0) + 1 });
    const blocked = link.outwardIssue?.key;
    const blocker = link.inwardIssue?.key;
    if (blocked) {
      console.log(`  outward → ${blocked} (${typeName}: this issue "${outward}" ${blocked})`);
    }
    if (blocker) {
      console.log(`  inward ← ${blocker} (${typeName}: this issue "${inward}" ${blocker})`);
    }
  }
}

console.log('\n=== Link type summary ===');
for (const [name, meta] of linkTypes) {
  console.log(`${name}: inward="${meta.inward}" outward="${meta.outward}" (${meta.count} occurrences)`);
}
console.log(`\n${withLinks}/${issues.length} sampled issues have issuelinks`);
