// Snapshot one or more automation rules to kyleOutput/jira-rule-backups/.
// Always run this before editing a rule so you have a rollback target.
//
// Usage: node scripts/jira/backup-rules.mjs <uuid>[:label] [<uuid>[:label] ...]
// Example:
//   node scripts/jira/backup-rules.mjs 019d556a-689f-72b8-9ebb-c1ccc83deea2:nova-uat \
//                                      019d556a-72df-7233-b88e-f2be5d296e5e:oprd-uat

import fs from 'node:fs';
import path from 'node:path';
import { getRule } from './_jiraAuto.mjs';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/jira/backup-rules.mjs <uuid>[:label] [...]');
  process.exit(1);
}

const outDir = 'kyleOutput/jira-rule-backups';
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

for (const arg of args) {
  const [uuid, label] = arg.split(':');
  try {
    const full = await getRule(uuid);
    const file = path.join(outDir, `${label || uuid}__${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(full, null, 2));
    console.log(`ok   ${label || uuid.slice(0, 8)}  -> ${file}`);
  } catch (e) {
    console.error(`fail ${uuid}: ${e.message}`);
  }
}
