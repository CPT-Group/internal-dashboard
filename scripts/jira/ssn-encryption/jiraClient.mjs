/**
 * Minimal Jira REST v3 client for one-off cursorScripts.
 * Loads KYLE_* from .env.local then Downloads env.jira.temp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');

dotenv.config({ path: path.join(root, '.env.local') });
const tempEnv = path.join(process.env.USERPROFILE ?? '', 'Downloads', 'env.jira.temp');
if (fs.existsSync(tempEnv)) {
  dotenv.config({ path: tempEnv });
}

export const KYLE_ACCOUNT_ID = '712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837';

const baseUrl = (process.env.JIRA_BASE_URL || 'https://cptgroup.atlassian.net').replace(/\/$/, '');
const email = process.env.KYLE_EMAIL;
const token = process.env.KYLE_JIRA_TOKEN;

if (!email?.trim() || !token?.trim()) {
  console.error('Missing KYLE_EMAIL or KYLE_JIRA_TOKEN');
  process.exit(1);
}

const auth = Buffer.from(`${email}:${token}`).toString('base64');

async function parseResponse(res) {
  const text = await res.text();
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(text);
      if (j.errorMessages?.length) msg = j.errorMessages.join('; ');
      else if (j.errors && typeof j.errors === 'object') {
        msg = Object.entries(j.errors)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
      }
    } catch {
      if (text) msg += ` — ${text.slice(0, 400)}`;
    }
    throw new Error(msg);
  }
  return text ? JSON.parse(text) : {};
}

export async function jira(apiPath, opts = {}) {
  const url = `${baseUrl}/rest/api/3${apiPath}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      ...opts.headers,
    },
  });
  return parseResponse(res);
}

export async function jiraAgile(apiPath, opts = {}) {
  const url = `${baseUrl}/rest/agile/1.0${apiPath}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      ...opts.headers,
    },
  });
  return parseResponse(res);
}

export function browseUrl(issueKey) {
  return `${baseUrl}/browse/${issueKey}`;
}

export function adfText(text, marks = []) {
  return { type: 'text', text, ...(marks.length ? { marks } : {}) };
}

export function adfPara(...parts) {
  return {
    type: 'paragraph',
    content: parts.map((p) => (typeof p === 'string' ? adfText(p) : p)),
  };
}

export function adfHeading(level, text) {
  return {
    type: 'heading',
    attrs: { level },
    content: [adfText(text)],
  };
}

export function adfBulletList(lines) {
  return {
    type: 'bulletList',
    content: lines.map((line) => ({
      type: 'listItem',
      content: [adfPara(line)],
    })),
  };
}

/** ADF panel — panelType: info | note | success | warning | error */
export function adfPanel(panelType, ...contentNodes) {
  return {
    type: 'panel',
    attrs: { panelType },
    content: contentNodes.flat(),
  };
}

export function adfMention(accountId, displayName) {
  return {
    type: 'mention',
    attrs: { id: accountId, text: `@${displayName}`, accessLevel: '' },
  };
}

export function adfParaWithMentions(parts) {
  return {
    type: 'paragraph',
    content: parts.map((p) => {
      if (typeof p === 'string') return adfText(p);
      return p;
    }),
  };
}

export function adfTable(headers, rows) {
  const headerRow = {
    type: 'tableRow',
    content: headers.map((h) => ({
      type: 'tableHeader',
      attrs: {},
      content: [adfPara(h)],
    })),
  };
  const dataRows = rows.map((cells) => ({
    type: 'tableRow',
    content: cells.map((c) => ({
      type: 'tableCell',
      attrs: {},
      content: [adfPara(String(c))],
    })),
  }));
  return {
    type: 'table',
    attrs: { isNumberColumnEnabled: false, layout: 'default' },
    content: [headerRow, ...dataRows],
  };
}

export async function transitionIssue(issueKey, targetStatusName) {
  const data = await jira(`/issue/${issueKey}/transitions`);
  const match = (data.transitions ?? []).find(
    (t) => t.to?.name === targetStatusName || t.name === targetStatusName
  );
  if (!match?.id) {
    const names = (data.transitions ?? []).map((t) => t.to?.name ?? t.name).join(', ');
    throw new Error(`No transition to "${targetStatusName}". Available: ${names}`);
  }
  await jira(`/issue/${issueKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: match.id } }),
  });
}

export async function addComment(issueKey, adfDoc) {
  return jira(`/issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body: adfDoc }),
  });
}

export async function updateDescription(issueKey, adfDoc) {
  return jira(`/issue/${issueKey}`, {
    method: 'PUT',
    body: JSON.stringify({ fields: { description: adfDoc } }),
  });
}

/** Jira worklog `started` — yyyy-MM-dd'T'HH:mm:ss.SSS±HHmm (local offset). */
export function toJiraStarted(input) {
  const d =
    typeof input === 'number'
      ? new Date(input * 1000)
      : input instanceof Date
        ? input
        : new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date for Jira worklog started: ${String(input)}`);
  }
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const offH = pad(Math.floor(abs / 60));
  const offM = pad(abs % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}${sign}${offH}${offM}`;
}

export async function addWorklog(issueKey, { timeSpentSeconds, started, commentText }) {
  const startedAt =
    typeof started === 'string' && /[+-]\d{4}$/.test(started) ? started : toJiraStarted(started);
  const body = {
    timeSpentSeconds,
    started: startedAt,
    comment: {
      type: 'doc',
      version: 1,
      content: [adfPara(commentText)],
    },
  };
  return jira(`/issue/${issueKey}/worklog`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
