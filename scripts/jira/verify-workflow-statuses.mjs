// Walks CM/OPRD/NOVA project statuses and flags every status ID that any of our
// edited automation rules reference, so we can prove each trigger actually fires.

import { AUTH, BASE, getRule } from './_jiraAuto.mjs';

const projects = ['CM', 'OPRD', 'NOVA'];
const statusesByProject = {};
for (const key of projects) {
  const r = await fetch(`${BASE}/rest/api/3/project/${key}/statuses`, { headers: { Authorization: AUTH, Accept: 'application/json' } });
  const arr = await r.json();
  const all = new Map();
  for (const typeBlock of arr) {
    for (const s of typeBlock.statuses) all.set(s.id, s.name);
  }
  statusesByProject[key] = all;
}

for (const [project, map] of Object.entries(statusesByProject)) {
  console.log(`\n--- ${project} statuses ---`);
  for (const [id, name] of [...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(id.padStart(6), ' ', name);
  }
}

const rulesToCheck = [
  { label: 'oprd-uat-reassign (OPRD)', uuid: '019d556a-72df-7233-b88e-f2be5d296e5e', project: 'OPRD' },
  { label: 'nova-uat-reassign (NOVA)', uuid: '019d556a-689f-72b8-9ebb-c1ccc83deea2', project: 'NOVA' },
  { label: 'cm-uat-reassign (CM)',      uuid: '019d556a-6dae-7e90-be20-d0982cc3d50b', project: 'CM'   },
  { label: 'nova-qa-requested (NEW, NOVA)', uuid: '019d98b7-e981-7c94-8a29-d161d13e0a37', project: 'NOVA' },
  { label: 'nova-move-to-sprint (NOVA)', uuid: '019d3183-076e-7e15-9fc7-d8bae4831e18', project: 'NOVA' },
  { label: 'cm-data-team-completed-work (CM)', uuid: '0193d5ab-6e19-75d2-90d8-55fca6824592', project: 'CM' },
  { label: 'cm-new-data-team-request (CM)', uuid: '0193d5a9-e200-7cb7-84e1-f72c1ae9ce2e', project: 'CM' },
];

console.log('\n\n=== Trigger sanity check ===');
for (const r of rulesToCheck) {
  const full = await getRule(r.uuid);
  const t = full.rule.trigger;
  const to = (t.value?.toStatus || []).map(s => s.type === 'ID' ? { id: s.value, name: statusesByProject[r.project]?.get(s.value) || '<NOT IN PROJECT>' } : { name: s.value });
  const from = (t.value?.fromStatus || []).map(s => s.type === 'ID' ? { id: s.value, name: statusesByProject[r.project]?.get(s.value) || '<NOT IN PROJECT>' } : { name: s.value });
  console.log(`\n${r.label}`);
  console.log('  trigger :', t.type);
  console.log('  from    :', from.length ? from : '(any)');
  console.log('  to      :', to.length ? to : '(any)');
}
