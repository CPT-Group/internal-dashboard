import { getRule } from './_jiraAuto.mjs';

const rules = [
  { label: 'oprd-uat-reassign', uuid: '019d556a-72df-7233-b88e-f2be5d296e5e' },
  { label: 'nova-uat-reassign', uuid: '019d556a-689f-72b8-9ebb-c1ccc83deea2' },
  { label: 'cm-uat-reassign',   uuid: '019d556a-6dae-7e90-be20-d0982cc3d50b' },
  { label: 'oprd-auto-assigns-roy (intake)', uuid: '019bb332-09dc-7358-a710-4fedff499888' },
  { label: 'nova-qa-requested', uuid: '019d98b7-e981-7c94-8a29-d161d13e0a37' },
  { label: 'nova-move-to-sprint', uuid: '019d3183-076e-7e15-9fc7-d8bae4831e18' },
  { label: 'nova-case-update-bugs-auto-add', uuid: '019d356a-ebd3-7b6e-b1f6-6a76d4449a53' },
  { label: 'cm-data-team-completed-work', uuid: '0193d5ab-6e19-75d2-90d8-55fca6824592' },
];

for (const r of rules) {
  const full = await getRule(r.uuid);
  const aris = full.rule?.ruleScopeARIs || [];
  console.log(r.label.padEnd(38), 'state=', full.rule?.state, ' scope=', JSON.stringify(aris));
}
