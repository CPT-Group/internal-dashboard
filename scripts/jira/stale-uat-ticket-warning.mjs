/**
 * Post stale UAT warning on NOVA tickets in UAT with due date before today (Pacific board scope).
 *
 * Stale = status UAT AND duedate < startOfDay() (due yesterday or earlier; due today is OK).
 * Skips tickets that already have a comment containing "STALE TICKET WARNING".
 *
 * Usage:
 *   node scripts/jira/stale-uat-ticket-warning.mjs           # dry-run
 *   node scripts/jira/stale-uat-ticket-warning.mjs --apply   # post comments
 *   node scripts/jira/stale-uat-ticket-warning.mjs --keys NOVA-123
 */
import fs from 'node:fs';
import {
  STALE_WARNING_MARKER,
  buildStaleUatWarningAdf,
} from './staleUatWarningAdf.mjs';

const apply = process.argv.includes('--apply');
const keysArg = process.argv.find((a) => a.startsWith('--keys='));
const explicitKeys = keysArg
  ? keysArg
      .slice('--keys='.length)
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
  : [];

const envText = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const l = envText.split(/\r?\n/).find((x) => x.startsWith(`${k}=`));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
};

const base = (get('JIRA_BASE_URL') || 'https://cptgroup.atlassian.net').replace(/\/$/, '');
const email = get('KYLE_EMAIL') || get('JAMES_EMAIL');
const token = get('KYLE_JIRA_TOKEN') || get('JAMES_JIRA_TOKEN');
const auth = Buffer.from(`${email}:${token}`).toString('base64');

/** NOVA UAT tickets with due date strictly before today (Pacific startOfDay). */
const JQL =
  'project = NOVA AND status = UAT AND duedate is not EMPTY AND duedate < startOfDay() ORDER BY duedate ASC';

const FIELDS = ['summary', 'status', 'assignee', 'duedate'].join(',');

async function searchAll(jql) {
  const issues = [];
  let nextPageToken;
  for (let page = 0; page < 20; page++) {
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
    if (!r.ok) throw new Error(`search/jql ${r.status} ${await r.text()}`);
    const data = await r.json();
    issues.push(...(data.issues ?? []));
    if (data.isLast || !data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }
  return issues;
}

async function fetchIssue(key) {
  const r = await fetch(`${base}/rest/api/3/issue/${key}?fields=${FIELDS}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`GET ${key} ${r.status} ${await r.text()}`);
  return r.json();
}

/** @returns {boolean} */
async function hasExistingStaleWarning(key) {
  const r = await fetch(`${base}/rest/api/3/issue/${key}/comment?maxResults=100`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`GET comments ${key} ${r.status} ${await r.text()}`);
  const data = await r.json();
  for (const c of data.comments ?? []) {
    const body = c.body;
    if (typeof body === 'string' && body.includes(STALE_WARNING_MARKER)) return true;
    if (body && typeof body === 'object') {
      const json = JSON.stringify(body);
      if (json.includes(STALE_WARNING_MARKER)) return true;
    }
  }
  return false;
}

async function postWarningComment(key, assignee) {
  const adf = buildStaleUatWarningAdf(
    assignee?.accountId
      ? { accountId: assignee.accountId, displayName: assignee.displayName ?? 'Assignee' }
      : null
  );
  const r = await fetch(`${base}/rest/api/3/issue/${key}/comment`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: adf }),
  });
  if (!r.ok) throw new Error(`POST comment ${key} ${r.status} ${await r.text()}`);
}

let issues;
if (explicitKeys.length > 0) {
  issues = [];
  for (const key of explicitKeys) {
    issues.push(await fetchIssue(key));
  }
} else {
  issues = await searchAll(JQL);
}

console.log(
  `${apply ? 'APPLY' : 'DRY-RUN'}: ${issues.length} candidate(s) in UAT with duedate < startOfDay()`
);
if (!explicitKeys.length) console.log(`JQL: ${JQL}\n`);

let wouldPost = 0;
let skipped = 0;
let failed = 0;

for (const issue of issues) {
  const key = issue.key;
  const f = issue.fields;
  const assignee = f?.assignee;
  const assigneeLabel = assignee?.displayName ?? '(unassigned)';
  const due = f?.duedate ?? '(none)';

  let alreadyWarned = false;
  try {
    alreadyWarned = await hasExistingStaleWarning(key);
  } catch (err) {
    console.log(`  [failed]  ${key} | comment check: ${err.message}`);
    failed++;
    continue;
  }

  if (alreadyWarned) {
    console.log(`  [skip]    ${key} | UAT | due=${due} | assignee=${assigneeLabel} | already has stale warning`);
    skipped++;
    continue;
  }

  const mentionNote = assignee?.accountId ? `@${assignee.displayName}` : '(no assignee mention)';
  const line = `  [${apply ? 'posted' : 'dry-run'}] ${key} | UAT | due=${due} | assignee=${assigneeLabel} | mention ${mentionNote}`;

  if (!apply) {
    console.log(line);
    wouldPost++;
    continue;
  }

  try {
    await postWarningComment(key, assignee);
    console.log(line);
    wouldPost++;
    await new Promise((r) => setTimeout(r, 300));
  } catch (err) {
    console.log(`  [failed]  ${key} | ${err.message}`);
    failed++;
  }
}

console.log(
  `\nDone: ${wouldPost} ${apply ? 'posted' : 'would post'}, ${skipped} skipped (already warned), ${failed} failed`
);
if (!apply && wouldPost > 0) console.log('Re-run with --apply to post warning panel comments.');
if (failed > 0) process.exitCode = 1;
