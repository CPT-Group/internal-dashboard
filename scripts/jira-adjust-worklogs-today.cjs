/**
 * List today's worklogs (America/Los_Angeles, same as jiraService) for the
 * authenticated user and optionally scale them down toward a target total.
 *
 * Usage:
 *   node scripts/jira-adjust-worklogs-today.cjs --dry-run
 *   node scripts/jira-adjust-worklogs-today.cjs --apply
 *
 * Strategy (default): if non-bug time alone is <= target hours, scale only
 * bug / bug sub-task worklogs proportionally to reach the target; otherwise
 * scale all worklogs proportionally. Each worklog is floored at 60 seconds;
 * if the plan is impossible, the script exits with an error without applying.
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const TARGET_HOURS = 7.3;
const TARGET_SECONDS = Math.round(TARGET_HOURS * 3600);
const MIN_SECONDS = 60;
const JIRA_PREFIX = '/rest/api/3';

function getConfig() {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  const email = process.env.KYLE_EMAIL;
  const token = process.env.KYLE_JIRA_TOKEN;
  if (!baseUrl || !email || !token) {
    throw new Error('JIRA_BASE_URL, KYLE_EMAIL, and KYLE_JIRA_TOKEN must be set (.env.local)');
  }
  const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
  return { baseUrl, authHeader };
}

async function jiraFetch(path, options = {}) {
  const { baseUrl, authHeader } = getConfig();
  const url = `${baseUrl}${JIRA_PREFIX}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader,
      ...options.headers,
    },
  });
  const bodyText = await response.text();
  if (!response.ok) {
    let message = `Jira ${response.status}: ${response.statusText}`;
    try {
      const err = JSON.parse(bodyText);
      if (err.errorMessages?.length) message = err.errorMessages.join('; ');
    } catch {
      if (bodyText) message += ` — ${bodyText.slice(0, 300)}`;
    }
    throw new Error(message);
  }
  return bodyText ? JSON.parse(bodyText) : {};
}

function todayPacificYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

function isBugTypeName(name) {
  const n = (name ?? '').toLowerCase();
  return n === 'bug' || n === 'bug sub-task';
}

async function searchAllIssueKeys(jql, maxIssues = 500) {
  const keys = [];
  let nextPageToken;
  for (let page = 0; page < 15 && keys.length < maxIssues; page++) {
    const body = {
      jql,
      maxResults: Math.min(100, maxIssues - keys.length),
      fields: ['key', 'issuetype'],
    };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const raw = await jiraFetch('/search/jql', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    for (const issue of raw.issues ?? []) {
      keys.push({
        key: issue.key,
        isBug: isBugTypeName(issue.fields?.issuetype?.name),
      });
    }
    if (raw.isLast || !raw.nextPageToken) break;
    nextPageToken = raw.nextPageToken;
  }
  return keys;
}

async function fetchAllWorklogsForIssue(issueKey) {
  const all = [];
  let startAt = 0;
  const pageSize = 100;
  for (;;) {
    const raw = await jiraFetch(
      `/issue/${encodeURIComponent(issueKey)}/worklog?startAt=${startAt}&maxResults=${pageSize}`
    );
    const chunk = raw.worklogs ?? [];
    all.push(...chunk);
    startAt += chunk.length;
    if (chunk.length < pageSize || startAt >= (raw.total ?? startAt)) break;
  }
  return all;
}

function planAdjustments(entries, targetSeconds) {
  const total = entries.reduce((s, e) => s + e.seconds, 0);
  if (total <= targetSeconds) {
    return { entries, total, newTotal: total, changed: [], strategy: 'none' };
  }

  const nonBug = entries.filter((e) => !e.isBug);
  const bugs = entries.filter((e) => e.isBug);
  const sumNon = nonBug.reduce((s, e) => s + e.seconds, 0);
  const sumBug = bugs.reduce((s, e) => s + e.seconds, 0);

  let strategy = 'all';
  let scaled = entries.map((e) => ({ ...e }));

  if (sumNon <= targetSeconds && sumBug > 0) {
    const desiredBug = targetSeconds - sumNon;
    const factor = desiredBug / sumBug;
    strategy = 'bugs-only';
    scaled = entries.map((e) => {
      if (!e.isBug) return { ...e, newSeconds: e.seconds };
      return { ...e, newSeconds: Math.max(MIN_SECONDS, Math.round(e.seconds * factor)) };
    });
    let newSum = scaled.reduce((s, e) => s + e.newSeconds, 0);
    if (newSum > targetSeconds) {
      const bugIndices = scaled
        .map((e, i) => (e.isBug ? i : -1))
        .filter((i) => i >= 0)
        .sort((a, b) => scaled[b].newSeconds - scaled[a].newSeconds);
      for (const i of bugIndices) {
        if (newSum <= targetSeconds) break;
        const room = scaled[i].newSeconds - MIN_SECONDS;
        if (room <= 0) continue;
        const cut = Math.min(room, newSum - targetSeconds);
        scaled[i].newSeconds -= cut;
        newSum -= cut;
      }
    } else if (newSum < targetSeconds) {
      const bugIndices = scaled
        .map((e, i) => (e.isBug ? i : -1))
        .filter((i) => i >= 0)
        .sort((a, b) => scaled[b].newSeconds - scaled[a].newSeconds);
      let deficit = targetSeconds - newSum;
      for (const i of bugIndices) {
        if (deficit <= 0) break;
        scaled[i].newSeconds += deficit;
        deficit = 0;
      }
    }
  } else {
    const factor = targetSeconds / total;
    strategy = 'all';
    scaled = entries.map((e) => ({
      ...e,
      newSeconds: Math.max(MIN_SECONDS, Math.round(e.seconds * factor)),
    }));
    let newSum = scaled.reduce((s, e) => s + e.newSeconds, 0);
    if (newSum > targetSeconds) {
      const order = scaled
        .map((e, i) => i)
        .sort((a, b) => scaled[b].newSeconds - scaled[a].newSeconds);
      for (const i of order) {
        if (newSum <= targetSeconds) break;
        const room = scaled[i].newSeconds - MIN_SECONDS;
        if (room <= 0) continue;
        const cut = Math.min(room, newSum - targetSeconds);
        scaled[i].newSeconds -= cut;
        newSum -= cut;
      }
    } else if (newSum < targetSeconds) {
      const order = scaled
        .map((e, i) => i)
        .sort((a, b) => scaled[b].newSeconds - scaled[a].newSeconds);
      let deficit = targetSeconds - newSum;
      for (const i of order) {
        if (deficit <= 0) break;
        scaled[i].newSeconds += deficit;
        deficit = 0;
      }
    }
  }

  const changed = scaled.filter((e) => e.newSeconds !== e.seconds);
  const newTotal = scaled.reduce((s, e) => s + e.newSeconds, 0);

  if (newTotal > targetSeconds) {
    throw new Error(
      `Could not reach target ${targetSeconds}s (got ${newTotal}s); try raising target or removing MIN_SECONDS floor.`
    );
  }

  return { entries: scaled, total, newTotal, changed, strategy };
}

async function updateWorklog(issueKey, worklogId, started, timeSpentSeconds) {
  await jiraFetch(
    `/issue/${encodeURIComponent(issueKey)}/worklog/${worklogId}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        started,
        timeSpentSeconds,
      }),
    }
  );
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dry = process.argv.includes('--dry-run') || !apply;
  if (!apply && !process.argv.includes('--dry-run')) {
    console.error('Pass --dry-run (default) or --apply');
    process.exit(1);
  }

  const myself = await jiraFetch('/myself');
  const accountId = myself.accountId;
  const ymd = todayPacificYmd();

  const jql = `worklogDate >= startOfDay() AND worklogAuthor = "${accountId}"`;
  const issues = await searchAllIssueKeys(jql, 500);

  /** @type {{ issueKey: string, worklogId: string, started: string, seconds: number, isBug: boolean, summary?: string }[]} */
  const entries = [];
  const keyToBug = new Map(issues.map((i) => [i.key, i.isBug]));

  for (const { key } of issues) {
    const worklogs = await fetchAllWorklogsForIssue(key);
    for (const wl of worklogs) {
      const startedDate = wl.started?.slice(0, 10);
      if (startedDate !== ymd || wl.author?.accountId !== accountId) continue;
      const sec = wl.timeSpentSeconds ?? 0;
      if (sec <= 0) continue;
      entries.push({
        issueKey: key,
        worklogId: String(wl.id),
        started: wl.started,
        seconds: sec,
        isBug: keyToBug.get(key) ?? false,
      });
    }
  }

  const totalSeconds = entries.reduce((s, e) => s + e.seconds, 0);
  const hours = (totalSeconds / 3600).toFixed(2);

  console.log(`User: ${myself.displayName} (${accountId})`);
  console.log(`Pacific today: ${ymd}`);
  console.log(`Worklogs today: ${entries.length}, total ${hours} h (${totalSeconds}s)`);
  for (const e of entries.sort((a, b) => b.seconds - a.seconds)) {
    console.log(
      `  ${e.issueKey} ${e.isBug ? '[BUG]' : '     '} ${(e.seconds / 3600).toFixed(2)}h  wl=${e.worklogId}`
    );
  }

  if (totalSeconds <= TARGET_SECONDS) {
    console.log(`At or below target (${TARGET_HOURS}h = ${TARGET_SECONDS}s). Nothing to do.`);
    return;
  }

  const plan = planAdjustments(entries, TARGET_SECONDS);
  console.log(`\nStrategy: ${plan.strategy}`);
  console.log(`New total: ${(plan.newTotal / 3600).toFixed(2)} h (${plan.newTotal}s), was ${(plan.total / 3600).toFixed(2)} h`);

  for (const e of plan.entries) {
    if (e.newSeconds !== e.seconds) {
      console.log(
        `  ADJ ${e.issueKey} ${e.seconds}s → ${e.newSeconds}s (${(e.newSeconds / 3600).toFixed(2)}h)`
      );
    }
  }

  if (dry) {
    console.log('\nDry run only. Re-run with --apply to update Jira.');
    return;
  }

  for (const e of plan.changed) {
    await updateWorklog(e.issueKey, e.worklogId, e.started, e.newSeconds);
    console.log(`Updated ${e.issueKey} worklog ${e.worklogId}`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
