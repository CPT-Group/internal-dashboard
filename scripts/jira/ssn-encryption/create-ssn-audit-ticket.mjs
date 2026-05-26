/**
 * Create NOVA ticket for CleanClaims SSN encryption audit; transition to In Dev.
 * Usage: node cursorScripts/jira/create-ssn-audit-ticket.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KYLE_ACCOUNT_ID,
  jira,
  jiraAgile,
  browseUrl,
  adfPara,
  adfHeading,
  adfBulletList,
  transitionIssue,
  addComment,
} from './jiraClient.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');
const timingPath = path.join(root, 'cursorScripts', 'jira', 'ssn-audit-timing.json');

const TASK_START_UTC = Math.floor(Date.now() / 1000);

const description = {
  type: 'doc',
  version: 1,
  content: [
    adfPara(
      'Periodic security audit: scan all CPT2K16 databases that contain dbo.CleanClaims and flag rows where SSN-related columns (ssn, ssnString, or similar) appear stored in plaintext instead of encrypted.'
    ),
    adfHeading(2, 'Goal'),
    adfBulletList([
      'Inventory every online database on CPT2K16 with a CleanClaims table.',
      'Detect SSN / ssnString (and similar) columns per database.',
      'Count rows that look unencrypted (e.g. 9-digit or ###-##-#### patterns).',
      'Capture last-modified timestamps where available for prioritization.',
      'Document findings in this ticket (table + counts); remediate in follow-up work.',
    ]),
    adfHeading(2, 'Scope'),
    adfBulletList([
      'Server: CPT2K16 (DB_* env from internal-dashboard .env.local).',
      'Table: dbo.CleanClaims only.',
      'Out of scope: website DBs on 10.0.0.5 (separate track if needed).',
    ]),
    adfHeading(2, 'Heuristics (initial pass)'),
    adfBulletList([
      'Plaintext: value matches 9 digits or ###-##-#### after trim.',
      'Likely encrypted: non-empty value that does not match plaintext SSN patterns (length, base64, etc.).',
      'Empty/null values excluded from unencrypted counts.',
    ]),
    adfHeading(2, 'Status'),
    adfPara('Audit in progress — results will be posted as comments and the summary table below will be updated.'),
  ],
};

async function main() {
  const fields = {
    project: { key: 'NOVA' },
    issuetype: { name: 'Task' },
    summary: '[Security] CPT2K16 CleanClaims SSN encryption audit (periodic check)',
    description,
    assignee: { accountId: KYLE_ACCOUNT_ID },
    labels: ['security', 'sql-audit', 'cleanclaims'],
  };

  const meta = await jira(
    '/issue/createmeta?projectKeys=NOVA&issuetypeNames=Task&expand=projects.issuetypes.fields'
  );
  const taskType = meta.projects?.[0]?.issuetypes?.find((t) => t.name === 'Task');
  if (taskType?.fields?.customfield_10193) {
    fields.customfield_10193 = { accountId: KYLE_ACCOUNT_ID };
  }

  const created = await jira('/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  const key = created.key;

  try {
    const boards = await jiraAgile('/board?projectKeyOrId=NOVA');
    const board = (boards.values ?? []).find((b) => b.type === 'scrum') ?? boards.values?.[0];
    if (board?.id) {
      const sprints = await jiraAgile(`/board/${board.id}/sprint?state=active`);
      const active = (sprints.values ?? [])[0];
      if (active?.id) {
        await jiraAgile(`/sprint/${active.id}/issue`, {
          method: 'POST',
          body: JSON.stringify({ issues: [key] }),
        });
        console.log(`Added to sprint: ${active.name}`);
      }
    }
  } catch (e) {
    console.warn('Sprint add skipped:', e instanceof Error ? e.message : e);
  }

  await transitionIssue(key, 'In Dev');
  console.log(`Transitioned ${key} → In Dev`);

  await addComment(key, {
    type: 'doc',
    version: 1,
    content: [
      adfPara('Audit started — scanning CPT2K16 for CleanClaims SSN columns. Results incoming.'),
    ],
  });

  fs.writeFileSync(
    timingPath,
    JSON.stringify({ issueKey: key, taskStartUtc: TASK_START_UTC, createdAt: new Date().toISOString() }, null, 2)
  );

  console.log(`Created ${key}`);
  console.log(browseUrl(key));
  console.log(`TASK_START_UTC=${TASK_START_UTC}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
