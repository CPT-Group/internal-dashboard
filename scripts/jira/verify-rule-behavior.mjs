import { getRule } from './_jiraAuto.mjs';

const rules = [
  { label: 'nova-uat-reassign', uuid: '019d556a-689f-72b8-9ebb-c1ccc83deea2' },
  { label: 'oprd-uat-reassign', uuid: '019d556a-72df-7233-b88e-f2be5d296e5e' },
  { label: 'cm-uat-reassign',   uuid: '019d556a-6dae-7e90-be20-d0982cc3d50b' },
  { label: 'nova-qa-requested', uuid: '019d98b7-e981-7c94-8a29-d161d13e0a37' },
  { label: 'cm-data-team-completed-work', uuid: '0193d5ab-6e19-75d2-90d8-55fca6824592' },
];

for (const r of rules) {
  const full = await getRule(r.uuid);
  const rule = full.rule;
  console.log(`\n=== ${r.label} (${rule.state}) ===`);
  console.log('canOtherRuleTrigger:', rule.canOtherRuleTrigger);
  console.log('components:');
  for (const c of rule.components) {
    const kind = `${c.component}/${c.type}`;
    let extra = '';
    if (c.type === 'jira.issue.assign') {
      const v = c.value;
      extra = `assignType=${v.assignType}` + (v.assignee ? ` assignee={type:${v.assignee.type},value:${v.assignee.value}}` : '');
      if (c.conditions?.length) extra += ` when=${c.conditions.map(x => x.value).join(' | ')}`;
    } else if (c.type === 'jira.issue.edit') {
      extra = `fields=${Object.keys(c.value?.fields || {}).join(',')}`;
    } else if (c.type === 'jira.issue.comment') {
      const body = c.value?.body || '';
      extra = `comment="${body.replace(/\s+/g, ' ').slice(0, 90)}${body.length > 90 ? '…' : ''}"`;
    } else if (c.type === 'jira.issue.transition') {
      extra = `toStatus=${c.value?.status?.value ?? JSON.stringify(c.value)}`;
    } else if (c.type === 'jira.jql.condition') {
      extra = `jql="${c.value}"`;
    }
    console.log('  -', kind, extra);
  }
}
