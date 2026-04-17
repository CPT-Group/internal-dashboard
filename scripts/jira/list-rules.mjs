// Paginate every automation rule summary in the CPT Jira Cloud tenant and print
// a compact table. Writes the full array to kyleOutput/jira-automation-rules.json
// for follow-up queries.
//
// Usage: node scripts/jira/list-rules.mjs [--filter <regex>] [--project <PROJ_ID>]
// Examples:
//   node scripts/jira/list-rules.mjs
//   node scripts/jira/list-rules.mjs --filter "UAT"
//   node scripts/jira/list-rules.mjs --project 10183
//
// Requires JAMES_EMAIL + JAMES_JIRA_TOKEN in .env.local (global-admin scope; see
// scripts/jira/README.md for why Kyle's token isn't sufficient).

import fs from 'node:fs';
import { AUTH, API } from './_jiraAuto.mjs';

const argv = process.argv.slice(2);
const get = flag => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
};
const filterRe = get('--filter') ? new RegExp(get('--filter'), 'i') : null;
const projectId = get('--project');

const all = [];
let cursor = null;
do {
  const qs = new URLSearchParams({ limit: '100' });
  if (cursor) qs.set('cursor', cursor);
  const r = await fetch(`${API}/rule/summary?${qs}`, { headers: { Authorization: AUTH, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`rule summary -> ${r.status} ${await r.text()}`);
  const j = await r.json();
  all.push(...(j.data || []));
  cursor = null;
  if (j.links?.next) {
    const m = j.links.next.match(/cursor=([^&]+)/);
    if (m) cursor = decodeURIComponent(m[1]);
  }
} while (cursor);

let rows = all;
if (filterRe) rows = rows.filter(r => filterRe.test(r.name));
if (projectId) rows = rows.filter(r => (r.ruleScopeARIs || []).some(a => a.endsWith(`project/${projectId}`)));

console.log(`Total rules: ${all.length}  |  matched: ${rows.length}${filterRe ? `  |  filter=/${filterRe.source}/i` : ''}${projectId ? `  |  project=${projectId}` : ''}\n`);
for (const r of rows) {
  console.log(`  ${r.uuid}  [${r.state.padEnd(8)}]  ${r.name}`);
}

fs.mkdirSync('kyleOutput', { recursive: true });
fs.writeFileSync('kyleOutput/jira-automation-rules.json', JSON.stringify(all, null, 2));
console.log(`\nWrote ${all.length} rules -> kyleOutput/jira-automation-rules.json`);
