/**
 * One-shot: create NOVA issue "AZ Consultant Prep", assign Kyle, add to active sprint.
 * Reads KYLE_EMAIL, KYLE_JIRA_TOKEN from .env.jira.temp then .env.local; optional JIRA_BASE_URL.
 *
 * Usage: node scripts/jira/create-nova-consultant-prep-task.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env.jira.temp') });
dotenv.config({ path: path.join(root, '.env.local') });

const KYLE_ACCOUNT_ID = '712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837';

const baseUrl = (process.env.JIRA_BASE_URL || 'https://cptgroup.atlassian.net').replace(
  /\/$/,
  ''
);
const email = process.env.KYLE_EMAIL;
const token = process.env.KYLE_JIRA_TOKEN;

if (!email?.trim() || !token?.trim()) {
  console.error('Missing KYLE_EMAIL or KYLE_JIRA_TOKEN (.env.jira.temp or .env.local)');
  process.exit(1);
}

const auth = Buffer.from(`${email}:${token}`).toString('base64');

async function jira(path, opts = {}) {
  const url = `${baseUrl}/rest/api/3${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      ...opts.headers,
    },
  });
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

async function jiraAgile(path, opts = {}) {
  const url = `${baseUrl}/rest/agile/1.0${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      ...opts.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(text);
      if (j.errorMessages?.length) msg = j.errorMessages.join('; ');
    } catch {
      if (text) msg += ` — ${text.slice(0, 400)}`;
    }
    throw new Error(msg);
  }
  return text ? JSON.parse(text) : {};
}

function heading(level, text) {
  return {
    type: 'heading',
    attrs: { level: level },
    content: [{ type: 'text', text }],
  };
}

function para(text) {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }],
  };
}

function bullets(lines) {
  return {
    type: 'bulletList',
    content: lines.map((line) => ({
      type: 'listItem',
      content: [para(line)],
    })),
  };
}

const description = {
  type: 'doc',
  version: 1,
  content: [
    para(
      'Prepare documentation and context for an Azure consultant engagement so they can ramp quickly on our environment, CI/CD, and gaps.'
    ),
    heading(2, '1) Infrastructure documentation pack (~23 documents)'),
    para(
      'Produce or consolidate roughly twenty-three documents that describe our current infrastructure: topology, subscriptions, resource groups, networking, identity, data paths, and how services relate to each other. Goal: a single coherent picture of what already exists (not aspirational architecture).'
    ),
    bullets([
      'Cover existing Azure footprint and integrations (as-built, not to-be).',
      'Include references to repos, pipelines, and runbooks where they exist.',
      'Keep each doc scoped so the set is navigable (TOC / index page optional follow-up).',
    ]),
    heading(2, '2) Pain points, blockers, and pipeline/Azure gaps'),
    para(
      'One focused document (or clearly labeled section) that spells out where we are stuck: pain points, what is blocking pipelines or Azure setup, and what we need from the consultant to get CI/CD and Azure aligned (permissions, patterns, reviews, or unknowns).'
    ),
    bullets([
      'List concrete blockers (e.g. auth, environments, approvals, tooling).',
      'Separate "facts we know" vs "questions we need answered".',
      'Call out dependencies on other teams or vendors if any.',
    ]),
  ],
};

async function main() {
  const boards = await jiraAgile('/board?projectKeyOrId=NOVA');
  const boardList = boards.values ?? [];
  const scrum =
    boardList.find((b) => b.type === 'scrum') ?? boardList[0];
  if (!scrum?.id) {
    console.error('No Jira Software board found for NOVA');
    process.exit(1);
  }

  const sprints = await jiraAgile(
    `/board/${scrum.id}/sprint?state=active`
  );
  const active = (sprints.values ?? [])[0];
  if (!active?.id) {
    console.error('No active sprint on board', scrum.name);
    process.exit(1);
  }

  const fields = {
    project: { key: 'NOVA' },
    issuetype: { name: 'Task' },
    summary: 'AZ Consultant Prep',
    description,
    assignee: { accountId: KYLE_ACCOUNT_ID },
  };

  const meta = await jira('/issue/createmeta?projectKeys=NOVA&issuetypeNames=Task&expand=projects.issuetypes.fields');
  const projects = meta.projects ?? [];
  const issueTypes = projects[0]?.issuetypes ?? [];
  const taskType = issueTypes.find((t) => t.name === 'Task');
  const fieldMeta = taskType?.fields ?? {};
  if (fieldMeta.customfield_10193) {
    fields.customfield_10193 = { accountId: KYLE_ACCOUNT_ID };
  }

  const created = await jira('/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });

  const key = created.key;
  await jiraAgile(`/sprint/${active.id}/issue`, {
    method: 'POST',
    body: JSON.stringify({ issues: [key] }),
  });

  console.log(`Created ${key} and added to sprint "${active.name}" (${active.id})`);
  console.log(`${baseUrl}/browse/${key}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
