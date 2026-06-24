/**
 * Fetch today's worklog entries for Kyle + James (Pacific startOfDay).
 * Usage: node scripts/jira/adjust-worklogs-today.mjs [--apply] [--target-hours=7]
 */
import fs from 'node:fs';

const apply = process.argv.includes('--apply');
const targetHoursArg = process.argv.find((a) => a.startsWith('--target-hours='));
const TARGET_HOURS = targetHoursArg ? Number(targetHoursArg.split('=')[1]) : 7;

const KYLE_ID = '712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837';
const JAMES_ID = '712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef';
const AUTHORS = [
  { id: KYLE_ID, label: 'Kyle Dilbeck' },
  { id: JAMES_ID, label: 'James Cassidy' },
];

const envText = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const l = envText.split(/\r?\n/).find((x) => x.startsWith(`${k}=`));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
};

const base = (get('JIRA_BASE_URL') || 'https://cptgroup.atlassian.net').replace(/\/$/, '');
const email = get('KYLE_EMAIL') || get('JAMES_EMAIL');
const token = get('KYLE_JIRA_TOKEN') || get('JAMES_JIRA_TOKEN');
const auth = Buffer.from(`${email}:${token}`).toString('base64');
const headers = {
  Authorization: `Basic ${auth}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const todayPacific = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const TARGET_SECONDS = TARGET_HOURS * 3600;
const MIN_SECONDS = 60;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatSeconds(total) {
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

async function searchIssuesWithWorklogsToday() {
  const authorList = AUTHORS.map((a) => `"${a.id}"`).join(', ');
  const jql = `worklogDate >= startOfDay() AND worklogAuthor in (${authorList}) ORDER BY updated DESC`;
  const issues = [];
  let nextPageToken;
  for (let page = 0; page < 30; page++) {
    const body = { jql, maxResults: 100, fields: ['key'] };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const r = await fetch(`${base}/rest/api/3/search/jql`, {
      method: 'POST',
      headers,
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

async function fetchWorklogsForIssue(issueKey) {
  const all = [];
  let startAt = 0;
  while (true) {
    const r = await fetch(`${base}/rest/api/3/issue/${issueKey}/worklog?startAt=${startAt}&maxResults=100`, {
      headers: { Authorization: headers.Authorization, Accept: 'application/json' },
    });
    if (!r.ok) throw new Error(`${issueKey} worklog ${r.status} ${await r.text()}`);
    const data = await r.json();
    all.push(...(data.worklogs ?? []));
    if (data.total <= startAt + (data.worklogs?.length ?? 0)) break;
    startAt += data.worklogs?.length ?? 0;
  }
  return all;
}

/** @returns {Array<{ issueKey: string, id: string, authorId: string, seconds: number, started: string, comment: string }>} */
async function collectTodayEntries() {
  const issues = await searchIssuesWithWorklogsToday();
  const authorSet = new Set(AUTHORS.map((a) => a.id));
  const entries = [];

  for (const issue of issues) {
    const worklogs = await fetchWorklogsForIssue(issue.key);
    for (const wl of worklogs) {
      const startedDate = wl.started?.slice(0, 10);
      const authorId = wl.author?.accountId;
      if (startedDate !== todayPacific || !authorSet.has(authorId)) continue;
      entries.push({
        issueKey: issue.key,
        id: String(wl.id),
        authorId,
        seconds: wl.timeSpentSeconds ?? 0,
        started: wl.started,
        comment: typeof wl.comment === 'string' ? wl.comment : '',
      });
    }
    await sleep(100);
  }
  return entries;
}

function proportionalTargets(entries, targetSeconds) {
  const total = entries.reduce((s, e) => s + e.seconds, 0);
  if (total === 0) return [];

  const scale = targetSeconds / total;
  const byIssue = new Map();
  for (const e of entries) {
    if (!byIssue.has(e.issueKey)) byIssue.set(e.issueKey, []);
    byIssue.get(e.issueKey).push(e);
  }

  /** @type {Array<{ issueKey: string, id: string, authorId: string, seconds: number, started: string, comment: string, newSeconds: number, delete: boolean }>} */
  const planned = [];

  for (const [, issueEntries] of byIssue) {
    const issueTotal = issueEntries.reduce((s, e) => s + e.seconds, 0);
    let issueTarget = Math.round(issueTotal * scale);

    const issuePlanned = issueEntries.map((e) => ({
      ...e,
      newSeconds: issueTotal > 0 ? Math.max(0, Math.round((e.seconds / issueTotal) * issueTarget)) : 0,
      delete: false,
    }));

    let issueSum = issuePlanned.reduce((s, e) => s + e.newSeconds, 0);
    let issueDrift = issueTarget - issueSum;
    const bySize = [...issuePlanned].sort((a, b) => b.newSeconds - a.newSeconds);
    let idx = 0;
    while (issueDrift !== 0 && bySize.length > 0) {
      const entry = bySize[idx % bySize.length];
      const step = issueDrift > 0 ? 60 : -60;
      const next = entry.newSeconds + step;
      if (next >= 0) {
        entry.newSeconds = next;
        issueDrift -= step;
      }
      idx += 1;
      if (idx > bySize.length * 100) break;
    }

    for (const p of issuePlanned) {
      if (p.newSeconds < MIN_SECONDS) {
        p.delete = p.newSeconds === 0;
        if (!p.delete) p.newSeconds = MIN_SECONDS;
      }
    }

    planned.push(...issuePlanned);
  }

  let sum = planned.filter((p) => !p.delete).reduce((s, e) => s + e.newSeconds, 0);
  let drift = targetSeconds - sum;
  const adjustable = planned.filter((p) => !p.delete).sort((a, b) => b.newSeconds - a.newSeconds);
  let i = 0;
  while (Math.abs(drift) >= 60 && adjustable.length > 0) {
    const entry = adjustable[i % adjustable.length];
    const step = drift > 0 ? 60 : -60;
    const next = entry.newSeconds + step;
    if (next >= MIN_SECONDS) {
      entry.newSeconds = next;
      drift -= step;
    }
    i += 1;
    if (i > adjustable.length * 200) break;
  }

  return planned;
}

async function deleteWorklog(issueKey, worklogId) {
  const r = await fetch(`${base}/rest/api/3/issue/${issueKey}/worklog/${worklogId}`, {
    method: 'DELETE',
    headers: { Authorization: headers.Authorization, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`DELETE ${issueKey}/${worklogId} ${r.status} ${await r.text()}`);
}

async function updateWorklog(issueKey, worklogId, started, newSeconds) {
  const r = await fetch(`${base}/rest/api/3/issue/${issueKey}/worklog/${worklogId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      started,
      timeSpent: formatSeconds(newSeconds),
    }),
  });
  if (!r.ok) throw new Error(`PUT ${issueKey}/${worklogId} ${r.status} ${await r.text()}`);
}

async function main() {
  console.log(`Pacific today: ${todayPacific}`);
  console.log(`${apply ? 'APPLY' : 'DRY-RUN'} — target ${TARGET_HOURS}h (${TARGET_SECONDS}s) per author\n`);

  const entries = await collectTodayEntries();
  for (const author of AUTHORS) {
    const mine = entries.filter((e) => e.authorId === author.id);
    const total = mine.reduce((s, e) => s + e.seconds, 0);
    console.log(`=== ${author.label} — ${formatSeconds(total)} (${mine.length} entries) ===`);
    for (const e of mine.sort((a, b) => b.seconds - a.seconds)) {
      console.log(`  ${e.issueKey} | ${formatSeconds(e.seconds)} | wl#${e.id} | ${e.comment.slice(0, 40)}`);
    }
    console.log('');
  }

  if (!apply) {
    console.log('--- Proposed adjustments ---\n');
  }

  for (const author of AUTHORS) {
    const mine = entries.filter((e) => e.authorId === author.id);
    const total = mine.reduce((s, e) => s + e.seconds, 0);
    if (mine.length === 0) {
      console.log(`${author.label}: no entries today — skip`);
      continue;
    }
    if (Math.abs(total - TARGET_SECONDS) < 60) {
      console.log(`${author.label}: already ~${TARGET_HOURS}h (${formatSeconds(total)}) — skip`);
      continue;
    }

    const planned = proportionalTargets(mine, TARGET_SECONDS);
    const newTotal = planned.filter((p) => !p.delete).reduce((s, e) => s + e.newSeconds, 0);
    console.log(`${author.label}: ${formatSeconds(total)} → ${formatSeconds(newTotal)} (${planned.length} entries)`);

    for (const p of planned.sort((a, b) => a.issueKey.localeCompare(b.issueKey))) {
      const delta = p.newSeconds - p.seconds;
      const sign = delta >= 0 ? '+' : '';
      const action = p.delete ? 'DELETE' : `${formatSeconds(p.seconds)} → ${formatSeconds(p.newSeconds)} (${sign}${Math.round(delta / 60)}m)`;
      const line = `  ${p.issueKey} | ${action}`;
      if (!apply) {
        console.log(line);
        continue;
      }
      try {
        if (p.delete) {
          await deleteWorklog(p.issueKey, p.id);
          console.log(`  [deleted] ${line.trim()}`);
        } else if (p.newSeconds !== p.seconds) {
          await updateWorklog(p.issueKey, p.id, p.started, p.newSeconds);
          console.log(`  [updated] ${line.trim()}`);
        }
        await sleep(300);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  [failed] ${p.issueKey} wl#${p.id} — ${msg}`);
      }
    }
    console.log('');
  }

  if (!apply) {
    console.log('Re-run with --apply to write changes.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
