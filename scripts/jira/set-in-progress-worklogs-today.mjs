/**
 * Set today's Pacific worklogs for Kyle + James on their NOVA "In Dev" tickets only.
 * Deletes any other worklogs logged today, then creates one entry per destination ticket.
 * Minutes are always an uneven distinct split (no two tickets share the same minute count).
 *
 * Usage:
 *   node scripts/jira/set-in-progress-worklogs-today.mjs --hours=4
 *   node scripts/jira/set-in-progress-worklogs-today.mjs k:6 j:7.2 --apply
 *   node scripts/jira/set-in-progress-worklogs-today.mjs k:+1 j:-0.5 --apply
 *   node scripts/jira/set-in-progress-worklogs-today.mjs --james-hours=3 --apply
 *   node scripts/jira/set-in-progress-worklogs-today.mjs k:4 --include-dev-review --apply
 *   node scripts/jira/set-in-progress-worklogs-today.mjs k:+2 --keys=NOVA-3434,NOVA-4789 --apply
 */
import fs from 'node:fs';

const apply = process.argv.includes('--apply');
const includeDevReview = process.argv.includes('--include-dev-review');
const keysArg = process.argv.find((a) => a.startsWith('--keys='));
/** Optional explicit destination keys (any status); skips default In Dev search when set. */
const explicitKeys = keysArg
  ? keysArg
      .slice('--keys='.length)
      .split(',')
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean)
  : [];
const rawArgs = process.argv
  .slice(2)
  .filter((a) => a !== '--apply' && a !== '--include-dev-review' && !a.startsWith('--keys='));

const DEFAULT_STATUSES = ['In Dev'];
const EXPANDED_STATUSES = ['In Dev', 'Dev Review'];

const KYLE_ID = '712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837';
const JAMES_ID = '712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef';
const MAX_HOURS_PER_PERSON = 21;

/** @typedef {{ kind: 'absolute' | 'delta', value: number }} TargetSpec */

/** @returns {{ kyle: TargetSpec | null; james: TargetSpec | null }} */
function parseTargetSpecs(args) {
  /** @type {{ kyle: TargetSpec | null; james: TargetSpec | null }} */
  const out = { kyle: null, james: null };

  const shared = args.find((a) => a.startsWith('--hours='));
  if (shared) {
    const h = Number(shared.split('=')[1]);
    if (Number.isFinite(h)) {
      out.kyle = { kind: 'absolute', value: h };
      out.james = { kind: 'absolute', value: h };
    }
  }

  for (const flag of ['--kyle-hours=', '--james-hours=']) {
    const entry = args.find((a) => a.startsWith(flag));
    if (!entry) continue;
    const raw = entry.slice(flag.length);
    const deltaMatch = raw.match(/^([+-])(\d+(?:\.\d+)?)$/);
    const key = flag === '--kyle-hours=' ? 'kyle' : 'james';
    if (deltaMatch) {
      const sign = deltaMatch[1] === '-' ? -1 : 1;
      out[key] = { kind: 'delta', value: sign * Number(deltaMatch[2]) };
    } else {
      const h = Number(raw);
      if (Number.isFinite(h)) out[key] = { kind: 'absolute', value: h };
    }
  }

  for (const token of args) {
    if (token.startsWith('--')) continue;
    const bare = Number(token);
    if (Number.isFinite(bare) && token.trim() !== '' && !token.includes(':')) {
      out.kyle = { kind: 'absolute', value: bare };
      out.james = { kind: 'absolute', value: bare };
      continue;
    }
    const m = token.match(/^(kyle|k|me|james|j)\s*[:=]?\s*([+-])?(\d+(?:\.\d+)?)$/i);
    if (!m) continue;
    const who = m[1].toLowerCase();
    const key = who === 'kyle' || who === 'k' || who === 'me' ? 'kyle' : 'james';
    const signPart = m[2];
    const num = Number(m[3]);
    if (!Number.isFinite(num)) continue;
    if (signPart === '+' || signPart === '-') {
      out[key] = { kind: 'delta', value: (signPart === '-' ? -1 : 1) * num };
    } else {
      out[key] = { kind: 'absolute', value: num };
    }
  }

  return out;
}

/**
 * @param {TargetSpec | null} spec
 * @param {number} currentHours
 * @returns {{ hours: number; clamped: boolean; rawHours: number }}
 */
function resolveTargetHours(spec, currentHours) {
  if (!spec) return { hours: 0, clamped: false, rawHours: 0 };
  const raw = spec.kind === 'delta' ? currentHours + spec.value : spec.value;
  const clamped = raw > MAX_HOURS_PER_PERSON || raw < 0;
  const hours = Math.min(MAX_HOURS_PER_PERSON, Math.max(0, raw));
  return { hours, clamped, rawHours: raw };
}

const specs = parseTargetSpecs(rawArgs);

const envText = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const l = envText.split(/\r?\n/).find((x) => x.startsWith(`${k}=`));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
};

const base = (get('JIRA_BASE_URL') || 'https://cptgroup.atlassian.net').replace(/\/$/, '');

function authHeadersForAuthor(authorId) {
  const isJames = authorId === JAMES_ID;
  const email = isJames ? get('JAMES_EMAIL') : get('KYLE_EMAIL');
  const token = isJames ? get('JAMES_JIRA_TOKEN') : get('KYLE_JIRA_TOKEN');
  if (!email || !token) {
    throw new Error(`Missing Jira credentials for ${isJames ? 'James' : 'Kyle'}`);
  }
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  return {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

const readEmail = get('KYLE_EMAIL') || get('JAMES_EMAIL');
const readToken = get('KYLE_JIRA_TOKEN') || get('JAMES_JIRA_TOKEN');
const readAuth = Buffer.from(`${readEmail}:${readToken}`).toString('base64');
const headers = {
  Authorization: `Basic ${readAuth}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const todayPacific = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
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

/**
 * Split totalSeconds into `count` minute values that are all distinct integers ≥ 1.
 * Uses 1..n as the base set, then randomly bumps slots until the target sum is hit,
 * then shuffles assignment. If 1..count already exceeds the target, uses as many
 * tickets as the triangular number allows (drops the rest).
 * @param {number} totalSeconds
 * @param {number} count
 * @returns {number[]} seconds per ticket (length may be < count when total is too small)
 */
function distinctUnevenSplitSeconds(totalSeconds, count) {
  if (count === 0 || totalSeconds <= 0) return [];
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));

  let n = count;
  while (n > 1 && (n * (n + 1)) / 2 > totalMinutes) n -= 1;

  /** @type {number[]} */
  const minutes = Array.from({ length: n }, (_, i) => i + 1);
  let remaining = totalMinutes - minutes.reduce((s, v) => s + v, 0);
  const used = new Set(minutes);
  let guard = 0;
  while (remaining > 0 && guard < totalMinutes * 200) {
    const i = Math.floor(Math.random() * n);
    const next = minutes[i] + 1;
    if (!used.has(next)) {
      used.delete(minutes[i]);
      minutes[i] = next;
      used.add(next);
      remaining -= 1;
    }
    guard += 1;
  }
  if (remaining > 0) {
    const max = Math.max(...minutes);
    minutes[minutes.indexOf(max)] += remaining;
  }

  for (let i = minutes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = minutes[i];
    minutes[i] = minutes[j];
    minutes[j] = tmp;
  }

  return minutes.map((m) => m * 60);
}

function pacificWorklogStarted(index, total) {
  // Spread across the workday with a light random jitter so starts aren't identical.
  const hour = 8 + Math.floor((index * 7) / Math.max(total, 1));
  const minute = (index * 17 + Math.floor(Math.random() * 7)) % 60;
  const hh = String(Math.min(16, hour)).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${todayPacific}T${hh}:${mm}:00.000-0700`;
}

async function fetchIssuesByKeys(keys) {
  if (keys.length === 0) return [];
  const quoted = keys.map((k) => `"${k}"`).join(', ');
  const jql = `key in (${quoted}) ORDER BY key ASC`;
  return searchIssues(jql);
}

async function searchIssues(jql) {
  const issues = [];
  let nextPageToken;
  for (let page = 0; page < 20; page++) {
    const body = { jql, maxResults: 100, fields: ['summary', 'status', 'assignee'] };
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

async function fetchActiveDevIssues(accountId, statuses = DEFAULT_STATUSES) {
  const statusList = statuses.map((s) => `"${s}"`).join(', ');
  const jql = `project = NOVA AND assignee = ${accountId} AND status IN (${statusList}) ORDER BY status ASC, key ASC`;
  return searchIssues(jql);
}

async function searchIssuesWithWorklogsToday(accountIds) {
  const authorList = accountIds.map((id) => `"${id}"`).join(', ');
  const jql = `worklogDate >= startOfDay() AND worklogAuthor in (${authorList}) ORDER BY updated DESC`;
  return searchIssues(jql);
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

async function collectTodayEntriesForAuthors(accountIds) {
  const authorSet = new Set(accountIds);
  const issues = await searchIssuesWithWorklogsToday(accountIds);
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
      });
    }
    await sleep(80);
  }
  return entries;
}

async function deleteWorklog(issueKey, worklogId) {
  const r = await fetch(`${base}/rest/api/3/issue/${issueKey}/worklog/${worklogId}`, {
    method: 'DELETE',
    headers: { Authorization: headers.Authorization, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`DELETE ${issueKey}/${worklogId} ${r.status} ${await r.text()}`);
}

async function createWorklog(issueKey, started, seconds, authorId) {
  const authorHeaders = authHeadersForAuthor(authorId);
  const r = await fetch(`${base}/rest/api/3/issue/${issueKey}/worklog`, {
    method: 'POST',
    headers: authorHeaders,
    body: JSON.stringify({
      started,
      timeSpent: formatSeconds(seconds),
    }),
  });
  if (!r.ok) throw new Error(`POST ${issueKey} ${r.status} ${await r.text()}`);
}

/** @type {Array<{ id: string; label: string; targetHours: number; spec: TargetSpec; currentHours: number; clamped: boolean }>} */
let AUTHORS = [];

async function buildAuthors() {
  const neededIds = [];
  if (specs.kyle) neededIds.push(KYLE_ID);
  if (specs.james) neededIds.push(JAMES_ID);
  if (neededIds.length === 0) return [];

  const allToday = await collectTodayEntriesForAuthors(neededIds);
  /** @type {Array<{ id: string; label: string; targetHours: number; spec: TargetSpec; currentHours: number; clamped: boolean }>} */
  const authors = [];

  if (specs.kyle) {
    const currentSeconds = allToday.filter((e) => e.authorId === KYLE_ID).reduce((s, e) => s + e.seconds, 0);
    const currentHours = currentSeconds / 3600;
    const resolved = resolveTargetHours(specs.kyle, currentHours);
    authors.push({
      id: KYLE_ID,
      label: 'Kyle Dilbeck',
      targetHours: resolved.hours,
      spec: specs.kyle,
      currentHours,
      clamped: resolved.clamped,
    });
  }
  if (specs.james) {
    const currentSeconds = allToday.filter((e) => e.authorId === JAMES_ID).reduce((s, e) => s + e.seconds, 0);
    const currentHours = currentSeconds / 3600;
    const resolved = resolveTargetHours(specs.james, currentHours);
    authors.push({
      id: JAMES_ID,
      label: 'James Cassidy',
      targetHours: resolved.hours,
      spec: specs.james,
      currentHours,
      clamped: resolved.clamped,
    });
  }
  return { authors, allToday };
}

async function main() {
  if (!specs.kyle && !specs.james) {
    console.error(`Usage:
  node scripts/jira/set-in-progress-worklogs-today.mjs --hours=4 [--apply]
  node scripts/jira/set-in-progress-worklogs-today.mjs k:6 j:7.2 [--apply]
  node scripts/jira/set-in-progress-worklogs-today.mjs k:+1 j:-0.5 [--apply]
  node scripts/jira/set-in-progress-worklogs-today.mjs --james-hours=+2 [--apply]

Max ${MAX_HOURS_PER_PERSON}h per person per day (Pacific).`);
    process.exit(1);
  }

  const { authors, allToday } = await buildAuthors();
  AUTHORS = authors;

  console.log(`Pacific today: ${todayPacific}`);
  const statusLabel = includeDevReview ? 'In Dev + Dev Review' : 'In Dev';
  const destLabel = explicitKeys.length > 0 ? `explicit keys (${explicitKeys.length})` : statusLabel;
  console.log(
    `${apply ? 'APPLY' : 'DRY-RUN'} — max ${MAX_HOURS_PER_PERSON}h/person on ${destLabel}; distinct uneven minutes\n`
  );

  const activeStatuses = includeDevReview ? EXPANDED_STATUSES : DEFAULT_STATUSES;

  for (const author of AUTHORS) {
    const targetSeconds = Math.round(author.targetHours * 3600);
    const inProgress =
      explicitKeys.length > 0
        ? await fetchIssuesByKeys(explicitKeys)
        : await fetchActiveDevIssues(author.id, activeStatuses);
    const inProgressKeys = new Set(inProgress.map((i) => i.key));
    const mineToday = allToday.filter((e) => e.authorId === author.id);
    const toDeleteAll = mineToday;

    const deltaNote =
      author.spec.kind === 'delta'
        ? ` (${formatSeconds(Math.round(author.currentHours * 3600))} ${author.spec.value >= 0 ? '+' : ''}${author.spec.value}h → ${formatSeconds(targetSeconds)})`
        : author.currentHours > 0 && author.spec.kind === 'absolute'
          ? ` (was ${formatSeconds(Math.round(author.currentHours * 3600))})`
          : '';
    const capNote = author.clamped ? ` [capped to 0–${MAX_HOURS_PER_PERSON}h]` : '';

    if (inProgress.length === 0) {
      console.log(`=== ${author.label} — target ${formatSeconds(targetSeconds)}${deltaNote}${capNote} ===`);
      console.log(`No destination tickets — skip\n`);
      continue;
    }

    const perTicket = distinctUnevenSplitSeconds(targetSeconds, inProgress.length);
    // If triangular bound dropped some tickets, only create for the first N that got minutes.
    const destIssues = inProgress.slice(0, perTicket.length);
    const plannedTotal = perTicket.reduce((s, v) => s + v, 0);

    console.log(`=== ${author.label} — target ${formatSeconds(targetSeconds)}${deltaNote}${capNote} ===`);
    console.log(`Destination tickets (${destIssues.length}${destIssues.length < inProgress.length ? ` of ${inProgress.length} requested` : ''}):`);
    destIssues.forEach((issue, idx) => {
      const sec = perTicket[idx] ?? 0;
      const statusName = issue.fields?.status?.name ?? '';
      console.log(`  ${issue.key} | ${formatSeconds(sec)} | ${statusName} | ${issue.fields.summary.slice(0, 55)}`);
    });

    const currentTotal = mineToday.reduce((s, e) => s + e.seconds, 0);
    console.log(`Today's worklogs now: ${formatSeconds(currentTotal)} (${mineToday.length} entries)`);
    const toDelete = mineToday.filter((e) => !inProgressKeys.has(e.issueKey));
    if (toDelete.length > 0) {
      console.log(`Off-board today (will delete): ${toDelete.map((e) => `${e.issueKey} ${formatSeconds(e.seconds)}`).join(', ')}`);
    }
    const onBoard = mineToday.filter((e) => inProgressKeys.has(e.issueKey));
    if (onBoard.length > 0) {
      console.log(`On-board today (will replace): ${onBoard.map((e) => `${e.issueKey} ${formatSeconds(e.seconds)}`).join(', ')}`);
    }
    console.log(`Planned total: ${formatSeconds(plannedTotal)}\n`);

    if (!apply) continue;

    for (const entry of toDeleteAll) {
      try {
        await deleteWorklog(entry.issueKey, entry.id);
        console.log(`  [deleted] ${entry.issueKey} wl#${entry.id} (${formatSeconds(entry.seconds)})`);
        await sleep(250);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  [delete failed] ${entry.issueKey} wl#${entry.id} — ${msg}`);
      }
    }

    if (targetSeconds <= 0) {
      console.log('  [skip create] target is 0h\n');
      continue;
    }

    for (let idx = 0; idx < destIssues.length; idx++) {
      const issue = destIssues[idx];
      const seconds = perTicket[idx] ?? MIN_SECONDS;
      const started = pacificWorklogStarted(idx, destIssues.length);
      try {
        await createWorklog(issue.key, started, seconds, author.id);
        console.log(`  [created] ${issue.key} ${formatSeconds(seconds)} @ ${started.slice(11, 16)} PT`);
        await sleep(300);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  [create failed] ${issue.key} — ${msg}`);
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
