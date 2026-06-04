/**
 * Discover open tickets missing Jira Components with fuzzy suggestions.
 *
 * Usage:
 *   node scripts/jira/discover-missing-components.mjs
 *   node scripts/jira/discover-missing-components.mjs --project NOVA
 *   node scripts/jira/discover-missing-components.mjs --include-done
 */
import fs from 'node:fs';
import { suggestComponent, meetsMinConfidence } from './componentMatchRules.mjs';

const args = process.argv.slice(2);
const projectFilter = args.includes('--project') ? args[args.indexOf('--project') + 1]?.toUpperCase() : null;
const includeDone = args.includes('--include-done');

const envText = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const l = envText.split(/\r?\n/).find((x) => x.startsWith(`${k}=`));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
};

const base = (get('JIRA_BASE_URL') || 'https://cptgroup.atlassian.net').replace(/\/$/, '');
const email = get('KYLE_EMAIL') || get('JAMES_EMAIL');
const token = get('KYLE_JIRA_TOKEN') || get('JAMES_JIRA_TOKEN');
const auth = Buffer.from(`${email}:${token}`).toString('base64');

const statusClause = includeDone ? '' : ' AND statusCategory != Done';
const projectClause = projectFilter ? `project = ${projectFilter}` : 'project IN (NOVA, CM, OPRD)';
const JQL = `${projectClause} AND component is EMPTY${statusClause} ORDER BY updated DESC`;

const FIELDS = ['summary', 'status', 'project', 'components', 'issuetype', 'labels'].join(',');

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

async function main() {
  const issues = await searchAll(JQL);
  const buckets = { high: [], medium: [], low: [], none: [] };

  for (const issue of issues) {
    const comps = issue.fields?.components ?? [];
    if (comps.length > 0) continue;

    const projectKey = issue.fields?.project?.key ?? '?';
    const suggestion = suggestComponent(projectKey, issue);
    const row = {
      key: issue.key,
      project: projectKey,
      status: issue.fields?.status?.name ?? '?',
      summary: (issue.fields?.summary ?? '').slice(0, 70),
      suggestion: suggestion.componentName || '(none)',
      confidence: suggestion.confidence,
      keywords: suggestion.matchedKeywords.join(', '),
    };
    buckets[suggestion.confidence].push(row);
  }

  console.log(`Missing components — ${issues.length} ticket(s)\nJQL: ${JQL}\n`);

  for (const level of ['high', 'medium', 'low', 'none']) {
    const rows = buckets[level];
    console.log(`=== ${level.toUpperCase()} (${rows.length}) ===`);
    for (const r of rows.slice(0, 40)) {
      console.log(
        `  ${r.key} (${r.project}) | ${r.status} | → ${r.suggestion} | ${r.summary}${r.keywords ? ` [${r.keywords}]` : ''}`
      );
    }
    if (rows.length > 40) console.log(`  ... +${rows.length - 40} more`);
    console.log('');
  }

  console.log('Apply high-confidence only:');
  console.log('  node scripts/jira/backfill-missing-components.mjs --min-confidence high');
  console.log('Ask user before medium/low, then:');
  console.log('  node scripts/jira/backfill-missing-components.mjs --apply --keys NOVA-123,...');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
