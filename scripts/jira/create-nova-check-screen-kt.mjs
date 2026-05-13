/**
 * One-shot: NOVA "Check screen KT" — James trains Roy on check-screen tickets.
 * Assignee + Tech Owner = James. Adds issue to active sprint on board 516.
 *
 * Env: KYLE_EMAIL, KYLE_JIRA_TOKEN (.env.jira.temp or .env.local); optional JIRA_BASE_URL.
 *
 * Usage: node scripts/jira/create-nova-check-screen-kt.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env.jira.temp') });
dotenv.config({ path: path.join(root, '.env.local') });

/** James Cassidy — see src/constants/NOVA_TEAM.ts */
const JAMES_ACCOUNT_ID = '712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef';

/** NOVA Kanban — visible here; no sprints on this board type. */
const VISIBILITY_BOARD_ID = 516;
/** NOVA Scrum — active sprint lives here (Agile API). */
const SPRINT_BOARD_ID = 153;

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

async function jira(apiPath, opts = {}) {
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

async function jiraAgile(apiPath, opts = {}) {
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

function para(...content) {
  return { type: 'paragraph', content };
}

function text(s, marks) {
  const n = { type: 'text', text: s };
  if (marks?.length) n.marks = marks;
  return n;
}

function heading(level, s) {
  return {
    type: 'heading',
    attrs: { level },
    content: [text(s)],
  };
}

function bulletList(items) {
  return {
    type: 'bulletList',
    content: items.map((line) => ({
      type: 'listItem',
      content: [typeof line === 'string' ? para(text(line)) : para(...line)],
    })),
  };
}

function orderedList(items) {
  return {
    type: 'orderedList',
    attrs: { order: 1 },
    content: items.map((line) => ({
      type: 'listItem',
      content: [typeof line === 'string' ? para(text(line)) : para(...line)],
    })),
  };
}

const NOVA2216_HREF = 'https://cptgroup.atlassian.net/browse/NOVA-2216';

const description = {
  type: 'doc',
  version: 1,
  content: [
    para(
      text(
        'Knowledge transfer: James owns teaching Roy how to complete check-screen work so Roy can own these tickets going forward. This ticket tracks the KT plan, artifacts, and progress—not individual production check-screen fixes.'
      )
    ),
    heading(2, 'Goal'),
    bulletList([
      'Roy can complete a typical check-screen ticket end-to-end without James as primary executor.',
      'Shared expectations: what “done” means, where to look, and how to validate before handoff.',
    ]),
    heading(2, 'Example ticket'),
    para(
      text('See '),
      text('NOVA-2216', [{ type: 'link', attrs: { href: NOVA2216_HREF } }]),
      text(' for a recent example of this work pattern (do not edit that issue as part of this KT).')
    ),
    heading(2, 'Suggested process'),
    orderedList([
      'Prepare lightweight artifacts — a short checklist and/or a Confluence page covering scope, common pitfalls, verification steps, and links to relevant systems/docs.',
      'Walkthrough — James shows Roy hands-on using a real check-screen ticket (pick one in sprint or a controlled example). Roy drives with James coaching.',
      'Guided practice — Roy executes with James available for questions; James performs L3 (level 3) review on Roy’s work until outputs meet team standards.',
      'Solo with safety net — Roy owns new tickets; James only as needed until the team is confident Roy can handle them independently.',
    ]),
    heading(2, 'Roles'),
    bulletList([
      'James Cassidy — trainer, reviewer (L3), approves when KT exit criteria are met.',
      'Roy — learner; completes practice and production tickets under the phases above.',
    ]),
    heading(2, 'Exit criteria (adjust in ticket if needed)'),
    bulletList([
      'Checklist or Confluence KT page exists and is linked in a comment.',
      'At least one real ticket walked through with Roy performing substantive steps.',
      'At least one ticket completed primarily by Roy with James L3 sign-off.',
      'Team agreement (brief comment) that Roy can own check-screen tickets without James as default assignee.',
    ]),
  ],
};

async function main() {
  const kanban = await jiraAgile(`/board/${VISIBILITY_BOARD_ID}`);
  console.log(
    `Visibility board ${VISIBILITY_BOARD_ID}: ${kanban.name ?? '?'} (${kanban.type ?? '?'}) — Kanban has no sprint; issue is still NOVA and should appear if the board filter includes it.`
  );

  const scrum = await jiraAgile(`/board/${SPRINT_BOARD_ID}`);
  console.log(`Sprint board ${SPRINT_BOARD_ID}: ${scrum.name ?? '?'} (${scrum.type ?? '?'})`);

  const sprints = await jiraAgile(`/board/${SPRINT_BOARD_ID}/sprint?state=active`);
  const active = (sprints.values ?? [])[0];
  if (!active?.id) {
    console.error(
      `No active sprint on board ${SPRINT_BOARD_ID}. Response:`,
      JSON.stringify(sprints)
    );
    process.exit(1);
  }

  const fields = {
    project: { key: 'NOVA' },
    issuetype: { name: 'Task' },
    summary: 'Check screen KT',
    description,
    assignee: { accountId: JAMES_ACCOUNT_ID },
  };

  const meta = await jira(
    '/issue/createmeta?projectKeys=NOVA&issuetypeNames=Task&expand=projects.issuetypes.fields'
  );
  const projects = meta.projects ?? [];
  const issueTypes = projects[0]?.issuetypes ?? [];
  const taskType = issueTypes.find((t) => t.name === 'Task');
  const fieldMeta = taskType?.fields ?? {};
  if (fieldMeta.customfield_10193) {
    fields.customfield_10193 = { accountId: JAMES_ACCOUNT_ID };
  } else {
    console.warn('createmeta: Tech Owner (customfield_10193) not on Task screen — set manually in Jira.');
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

  console.log(`Created ${key} and added to sprint "${active.name}" (sprint id ${active.id})`);
  console.log(`${baseUrl}/browse/${key}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
