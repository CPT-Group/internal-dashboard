/**
 * Set Jira Components on tickets that have none. Never adds to tickets that already have components.
 *
 * Usage:
 *   node scripts/jira/backfill-missing-components.mjs                        # dry-run, high confidence
 *   node scripts/jira/backfill-missing-components.mjs --apply --min-confidence high
 *   node scripts/jira/backfill-missing-components.mjs --apply --keys NOVA-1,NOVA-2 --component "Static Website"
 *   node scripts/jira/backfill-missing-components.mjs --apply --min-confidence medium
 */
import fs from 'node:fs';
import {
  suggestComponent,
  componentIdForProject,
  meetsMinConfidence,
} from './componentMatchRules.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const includeDone = args.includes('--include-done');
const minConfidence = args.includes('--min-confidence')
  ? args[args.indexOf('--min-confidence') + 1]
  : 'high';
const projectFilter = args.includes('--project') ? args[args.indexOf('--project') + 1]?.toUpperCase() : null;
const keysArg = args.includes('--keys') ? args[args.indexOf('--keys') + 1] : null;
const forcedComponent = args.includes('--component') ? args[args.indexOf('--component') + 1] : null;

const envText = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const l = envText.split(/\r?\n/).find((x) => x.startsWith(`${k}=`));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
};

const base = (get('JIRA_BASE_URL') || 'https://cptgroup.atlassian.net').replace(/\/$/, '');
const email = get('KYLE_EMAIL') || get('JAMES_EMAIL');
const token = get('KYLE_JIRA_TOKEN') || get('JAMES_JIRA_TOKEN');
const auth = Buffer.from(`${email}:${token}`).toString('base64');

const FIELDS = ['summary', 'status', 'project', 'components', 'issuetype', 'labels'].join(',');

function buildJql() {
  if (keysArg) {
    const keys = keysArg.split(',').map((k) => k.trim()).filter(Boolean);
    return `key in (${keys.join(',')})`;
  }
  const statusClause = includeDone ? '' : ' AND statusCategory != Done';
  const projectClause = projectFilter ? `project = ${projectFilter}` : 'project IN (NOVA, CM, OPRD)';
  return `${projectClause} AND component is EMPTY${statusClause} ORDER BY updated DESC`;
}

async function searchAll(jql) {
  const issues = [];
  let nextPageToken;
  for (let page = 0; page < 50; page++) {
    const body = { jql, maxResults: 100, fields: FIELDS.split(',') };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const r = await fetch(`${base}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`search ${r.status} ${await r.text()}`);
    const data = await r.json();
    issues.push(...(data.issues ?? []));
    if (data.isLast || !data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }
  return issues;
}

async function setComponent(issueKey, componentId) {
  const r = await fetch(`${base}/rest/api/3/issue/${issueKey}`, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        components: [{ id: componentId }],
      },
    }),
  });
  if (!r.ok) throw new Error(`${issueKey} PUT ${r.status} ${await r.text()}`);
}

async function main() {
  const jql = buildJql();
  const issues = await searchAll(jql);

  console.log(`${apply ? 'APPLY' : 'DRY-RUN'} | min-confidence=${minConfidence}${forcedComponent ? ` | force=${forcedComponent}` : ''}`);
  console.log(`JQL: ${jql}\n`);

  let ok = 0;
  let skipped = 0;
  let fail = 0;
  let noMatch = 0;

  for (const issue of issues) {
    if ((issue.fields?.components ?? []).length > 0) {
      skipped += 1;
      continue;
    }

    const projectKey = issue.fields?.project?.key ?? '';
    const suggestion = forcedComponent
      ? { componentName: forcedComponent, confidence: 'high', score: 99, matchedKeywords: ['--component'] }
      : suggestComponent(projectKey, issue);

    if (!suggestion.componentName || suggestion.confidence === 'none') {
      noMatch += 1;
      continue;
    }

    if (!keysArg && !meetsMinConfidence(suggestion.confidence, minConfidence)) {
      continue;
    }

    const componentId = componentIdForProject(projectKey, suggestion.componentName);
    if (!componentId) {
      console.error(`  [skip] ${issue.key} — no component id for ${suggestion.componentName} on ${projectKey}`);
      fail += 1;
      continue;
    }

    const line = `${issue.key} (${projectKey}) | ${issue.fields?.status?.name} | → ${suggestion.componentName} (${suggestion.confidence}) | ${(issue.fields?.summary ?? '').slice(0, 55)}`;

    if (!apply) {
      console.log(`  [dry-run] ${line}`);
      ok += 1;
      continue;
    }

    try {
      await setComponent(issue.key, componentId);
      console.log(`  [updated] ${line}`);
      ok += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`  [failed]  ${line}`);
      console.error(`            ${error instanceof Error ? error.message : error}`);
      fail += 1;
    }
  }

  console.log(`\nDone: ${ok} ${apply ? 'updated' : 'would update'}, ${noMatch} no match, ${skipped} skipped (had components), ${fail} failed`);
  if (!apply) console.log('Re-run with --apply to write changes.');
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
