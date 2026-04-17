import { getRule } from './_jiraAuto.mjs';

/** Depth-first walk of rule components (including IF/ELSE `children`). */
function* walkComponents(components) {
  if (!Array.isArray(components)) return;
  for (const c of components) {
    yield c;
    if (c.children?.length) yield* walkComponents(c.children);
  }
}

const rules = [
  { label: 'nova-uat-reassign', uuid: '019d556a-689f-72b8-9ebb-c1ccc83deea2' },
  { label: 'oprd-uat-reassign', uuid: '019d556a-72df-7233-b88e-f2be5d296e5e' },
  { label: 'cm-uat-reassign',   uuid: '019d556a-6dae-7e90-be20-d0982cc3d50b' },
  { label: 'nova-qa-requested', uuid: '019d98b7-e981-7c94-8a29-d161d13e0a37' },
  { label: 'cm-data-team-completed-work', uuid: '0193d5ab-6e19-75d2-90d8-55fca6824592' },
];

for (const r of rules) {
  const full = await getRule(r.uuid);
  console.log(`\n=== ${r.label} ===`);
  for (const c of walkComponents(full.rule.components)) {
    if (c.type === 'jira.issue.comment') {
      console.log(JSON.stringify(c.value, null, 2));
    }
  }
}
