/**
 * Re-enable the NOVA Case Update Requests & Bugs auto-add-to-sprint intake rule.
 * Usage: node scripts/jira/enable-case-update-bugs-rule.mjs [--apply]
 */
import { API, AUTH, getRule } from './_jiraAuto.mjs';

const UUID = '019d356a-ebd3-7b6e-b1f6-6a76d4449a53';
const apply = process.argv.includes('--apply');

const before = await getRule(UUID);
console.log(`Rule: ${before.rule.name}`);
console.log(`State: ${before.rule.state}`);

if (before.rule.state === 'ENABLED') {
  console.log('Already ENABLED — nothing to do.');
  process.exit(0);
}

if (!apply) {
  console.log('\nDRY-RUN: would enable rule (assign Roy + Tech Owner=Roy on Case Update Request / Bug create).');
  console.log('Re-run with --apply to enable.');
  process.exit(0);
}

const r = await fetch(`${API}/rule/${UUID}/state`, {
  method: 'PUT',
  headers: {
    Authorization: AUTH,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ value: 'ENABLED' }),
});
const text = await r.text();
if (!r.ok) throw new Error(`PUT state -> ${r.status} ${text}`);

const after = await getRule(UUID);
console.log(`Enabled. State now: ${after.rule.state}`);
