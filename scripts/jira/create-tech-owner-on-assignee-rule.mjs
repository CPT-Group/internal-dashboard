/**
 * Create "[Data team] Assignee changed → set Tech Owner" automation rule(s).
 *
 * When assignee changes and Tech Owner (cf[10193]) is empty:
 *   Kyle assignee  → Tech Owner = Kyle
 *   Roy/Brandon/James assignee → Tech Owner = Roy
 *
 * Does not overwrite existing Tech Owner (trigger JQL gate).
 *
 * Usage:
 *   node scripts/jira/create-tech-owner-on-assignee-rule.mjs           # dry-run (print plan)
 *   node scripts/jira/create-tech-owner-on-assignee-rule.mjs --apply   # POST rule(s)
 *   node scripts/jira/create-tech-owner-on-assignee-rule.mjs --apply NOVA OPRD
 */
import {
  API,
  AUTH,
  CLOUD_ID,
  CF_TECH_OWNER,
  KYLE_ID,
  ROY_ID,
  BRANDON_ID,
} from './_jiraAuto.mjs';

const JAMES_ACCOUNT_ID = '712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef';
const JAMES_ID = '712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef';
const ACTOR_ACCOUNT = '557058:f58131cb-b67d-43c7-b30d-6b58d40bd077';
const RULE_NAME = '[Data team] Assignee changed → set Tech Owner';

const PROJECTS = {
  NOVA: { id: 10183, name: 'NOVA' },
  OPRD: { id: 10002, name: 'OPRD' },
  CM: { id: 10017, name: 'CM' },
};

const ROY_BRANCH_ASSIGNEES = [ROY_ID, BRANDON_ID, JAMES_ID];

const apply = process.argv.includes('--apply');
const requested = process.argv
  .slice(2)
  .filter((a) => a !== '--apply')
  .flatMap((t) => (t.toUpperCase() === 'ALL' ? ['NOVA', 'OPRD', 'CM'] : [t.toUpperCase()]));

function techOwnerEditAction(accountId) {
  return {
    component: 'ACTION',
    schemaVersion: 12,
    type: 'jira.issue.edit',
    value: {
      operations: [
        {
          field: { type: 'ID', value: CF_TECH_OWNER },
          fieldType: 'com.atlassian.jira.plugin.system.customfieldtypes:userpicker',
          type: 'SET',
          value: { type: 'ID', value: accountId },
        },
      ],
      advancedFields: null,
      sendNotifications: true,
    },
  };
}

function ifBlock(jql, children) {
  return {
    component: 'CONDITION_BLOCK',
    schemaVersion: 1,
    type: 'jira.condition.if.block',
    value: { conditionMatchType: 'ALL' },
    conditions: [
      {
        component: 'CONDITION',
        schemaVersion: 1,
        type: 'jira.jql.condition',
        value: jql,
      },
    ],
    children,
  };
}

function buildPayload({ name: projectName, id: projectId }) {
  const projectAri = `ari:cloud:jira:${CLOUD_ID}:project/${projectId}`;
  const assigneeIn = [KYLE_ID, ...ROY_BRANCH_ASSIGNEES].map((id) => `"${id}"`).join(', ');

  const container = {
    component: 'CONDITION',
    schemaVersion: 1,
    type: 'jira.condition.container.block',
    value: {},
    conditions: [],
    children: [
      ifBlock(`assignee = ${KYLE_ID}`, [techOwnerEditAction(KYLE_ID)]),
      ifBlock(`assignee in (${ROY_BRANCH_ASSIGNEES.map((id) => id).join(', ')})`, [
        techOwnerEditAction(ROY_ID),
      ]),
    ],
  };

  return {
    rule: {
      name: `${RULE_NAME} (${projectName})`,
      state: 'ENABLED',
      description:
        `When a ${projectName} ticket is assigned to Kyle, Roy, James, or Brandon and Tech Owner is empty, ` +
        `set Tech Owner from assignee rules (Kyle→Kyle; Roy/Brandon/James→Roy). Never overwrites existing Tech Owner.`,
      canOtherRuleTrigger: false,
      notifyOnError: 'FIRSTERROR',
      authorAccountId: JAMES_ACCOUNT_ID,
      actor: { type: 'ACCOUNT_ID', actor: ACTOR_ACCOUNT },
      trigger: {
        component: 'TRIGGER',
        schemaVersion: 1,
        type: 'jira.issue.event.trigger:assigned',
        value: {
          eventKey: 'jira:issue_updated',
          issueEvent: 'issue_assigned',
          eventFilters: [projectAri],
        },
        conditions: [
          {
            component: 'CONDITION',
            schemaVersion: 1,
            type: 'jira.jql.condition',
            value: `cf[10193] is EMPTY AND assignee in (${assigneeIn})`,
          },
        ],
      },
      components: [container],
      ruleScopeARIs: [projectAri],
      labels: [],
      writeAccessType: 'UNRESTRICTED',
      collaborators: [],
    },
    connections: [],
  };
}

async function listExistingNames() {
  const names = new Set();
  let cursor = null;
  do {
    const qs = new URLSearchParams({ limit: '100' });
    if (cursor) qs.set('cursor', cursor);
    const r = await fetch(`${API}/rule/summary?${qs}`, {
      headers: { Authorization: AUTH, Accept: 'application/json' },
    });
    const j = await r.json();
    for (const row of j.data ?? []) {
      if (row.name?.includes('Assignee changed') && row.name?.includes('Tech Owner')) {
        names.add(row.name);
      }
    }
    cursor = j.links?.next?.match(/cursor=([^&]+)/)?.[1]
      ? decodeURIComponent(j.links.next.match(/cursor=([^&]+)/)[1])
      : null;
  } while (cursor);
  return names;
}

async function postRule(payload) {
  const r = await fetch(`${API}/rule`, {
    method: 'POST',
    headers: {
      Authorization: AUTH,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`POST /rule -> ${r.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

const targets = requested.length > 0 ? requested : ['NOVA', 'OPRD', 'CM'];
const existing = await listExistingNames();

for (const key of targets) {
  const project = PROJECTS[key];
  if (!project) {
    console.error(`Unknown project: ${key}`);
    process.exit(1);
  }

  const payload = buildPayload(project);
  const ruleName = payload.rule.name;

  if (existing.has(ruleName)) {
    console.log(`skip ${project.name}: rule already exists (${ruleName})`);
    continue;
  }

  console.log(`\n--- ${apply ? 'CREATE' : 'DRY-RUN'} ${ruleName} ---`);
  console.log(`  trigger: issue assigned`);
  console.log(`  gate:    cf[10193] is EMPTY AND assignee in (Kyle, Roy, James, Brandon)`);
  console.log(`  Kyle assignee  → Tech Owner Kyle`);
  console.log(`  Roy/James/Brandon → Tech Owner Roy`);

  if (!apply) continue;

  try {
    const result = await postRule(payload);
    const uuid = result?.rule?.uuid ?? result?.uuid ?? '(unknown)';
    console.log(`ok   uuid=${uuid}`);
  } catch (err) {
    console.error(`fail ${project.name}: ${err.message}`);
    process.exitCode = 1;
  }
}

if (!apply) {
  console.log('\nRe-run with --apply to create rule(s).');
}
