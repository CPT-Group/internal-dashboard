/**
 * Exempt Jennifer Forst from "Ensure Due Date is at Least 24 Hours After Creation".
 * Usage: node scripts/jira/exempt-jennifer-forst-due-date-rule.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { getRule, JENNIFER_FORST_ID, putRule } from './_jiraAuto.mjs';

const RULE_UUID = '019d3181-bf73-73f9-92fa-1ee1a1d8ad52';

const dryRun = process.argv.includes('--dry-run');

/** Minimal shape — omit id/connectionId/parentId so Jira assigns stable ids on PUT. */
function initiatorNotJenniferCondition(conditionParentId) {
  return {
    component: 'CONDITION',
    schemaVersion: 1,
    type: 'jira.comparator.condition',
    value: {
      first: '{{initiator.accountId}}',
      second: JENNIFER_FORST_ID,
      operator: 'NOT_EQUALS',
    },
    conditions: [],
    conditionParentId,
    children: [],
  };
}

function hasJenniferExempt(conditions) {
  return conditions.some(
    (c) =>
      c.type === 'jira.comparator.condition' &&
      c.value?.first === '{{initiator.accountId}}' &&
      c.value?.second === JENNIFER_FORST_ID &&
      c.value?.operator === 'NOT_EQUALS'
  );
}

function patchIfBlocks(components) {
  let patched = 0;
  for (const comp of components) {
    if (comp.type === 'jira.condition.container.block') {
      for (const child of comp.children ?? []) {
        if (child.type !== 'jira.condition.if.block') continue;
        const blockId = child.id;
        if (hasJenniferExempt(child.conditions ?? [])) continue;
        child.conditions = [...(child.conditions ?? []), initiatorNotJenniferCondition(blockId)];
        patched += 1;
      }
    }
  }
  return patched;
}

const payload = await getRule(RULE_UUID);
const rule = payload.rule;
const before = JSON.stringify(rule.components);
const patched = patchIfBlocks(rule.components);

if (patched === 0) {
  console.log('No changes — Jennifer Forst exemption already present on all IF branches.');
  process.exit(0);
}

const outDir = path.join('kyleOutput', 'jira-rule-backups');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(
  path.join(outDir, `due-date-24h-before-jennifer-exempt__${stamp}.json`),
  JSON.stringify(payload, null, 2)
);

console.log(`Patched ${patched} IF branch(es): initiator != Jennifer Forst (${JENNIFER_FORST_ID})`);

if (dryRun) {
  console.log('Dry-run — no PUT. Re-run without --dry-run to apply.');
  process.exit(0);
}

await putRule(RULE_UUID, { rule });
console.log('Updated rule', RULE_UUID, '— Ensure Due Date is at Least 24 Hours After Creation');
