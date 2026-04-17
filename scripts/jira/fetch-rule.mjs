// Fetch a single automation rule by UUID and dump its full config to stdout + a
// JSON file under kyleOutput/jira-rule-backups/. Useful before making edits so
// you have a rollback snapshot and can inspect the component shapes.
//
// Usage: node scripts/jira/fetch-rule.mjs <uuid> [label]
// Example:
//   node scripts/jira/fetch-rule.mjs 019d556a-689f-72b8-9ebb-c1ccc83deea2 nova-uat-reassign

import fs from 'node:fs';
import path from 'node:path';
import { getRule } from './_jiraAuto.mjs';

const [uuid, label] = process.argv.slice(2);
if (!uuid) {
  console.error('Usage: node scripts/jira/fetch-rule.mjs <uuid> [label]');
  process.exit(1);
}

const full = await getRule(uuid);
const outDir = 'kyleOutput/jira-rule-backups';
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(outDir, `${label || uuid}__${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(full, null, 2));

console.log(`name     : ${full.rule.name}`);
console.log(`state    : ${full.rule.state}`);
console.log(`scope    : ${JSON.stringify(full.rule.ruleScopeARIs)}`);
console.log(`trigger  : ${full.rule.trigger?.type}`);
console.log(`components (${full.rule.components.length}):`);
for (const [i, c] of full.rule.components.entries()) {
  console.log(`  [${i}] ${c.component}/${c.type}`);
}
console.log(`\nSnapshot saved -> ${file}`);
