/**
 * Create NOVA sub-task under NOVA-2451 for SSN encryption remediation.
 * Usage: node cursorScripts/jira/create-ssn-encrypt-subtask.mjs
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
const PARENT_KEY = 'NOVA-2451';
const timingPath = path.join(__dirname, 'ssn-encrypt-timing.json');
const TASK_START_UTC = Math.floor(Date.now() / 1000);

const description = {
  type: 'doc',
  version: 1,
  content: [
    adfHeading(1, 'Issue'),
    adfPara(
      'Parent audit (NOVA-2451) found 4,389 plaintext-pattern SSN values across 155 CPT2K16 databases on dbo.CleanClaims. SSNs must be encrypted via the existing CPTSQL20 pipeline — not ad-hoc encryption on CPT2K16.'
    ),
    adfHeading(2, 'What needs to be done'),
    adfBulletList([
      'Discover CPTSQL20 encrypt/decrypt API (Windows auth); dummy SSN round-trip before production.',
      'Map how CPT2K16 case DBs invoke that pipeline.',
      'Add SSNEncryptedFix BIT NOT NULL DEFAULT 0 on CleanClaims (remediated DBs only).',
      'Encrypt only perfect 9-digit SSN format; export non-eligible values for manual review.',
      'First pass: SSN / ssnString / SSNString columns unless explicitly expanded.',
      'Re-audit and attach remediation CSVs; plaintext count → 0 for remediated scope.',
    ]),
    adfHeading(2, 'Done when'),
    adfBulletList([
      'Eligible plaintext values encrypted through official pipeline.',
      'SSNEncryptedFix = 1 on rows we changed.',
      'Manual-review CSV attached for skipped values.',
      'Verification audit posted on this subtask.',
    ]),
    adfPara('Parent: NOVA-2451'),
  ],
};

async function main() {
  const parent = await jira(`/issue/${PARENT_KEY}?fields=id`);
  const parentId = parent.id;

  const fields = {
    project: { key: 'NOVA' },
    issuetype: { name: 'Sub-task' },
    parent: { key: PARENT_KEY },
    summary: '[Security] Encrypt plaintext CleanClaims SSNs via CPTSQL20 pipeline',
    description,
    assignee: { accountId: KYLE_ACCOUNT_ID },
    labels: ['security', 'sql-remediation', 'cleanclaims'],
  };

  const meta = await jira(
    '/issue/createmeta?projectKeys=NOVA&issuetypeNames=Sub-task&expand=projects.issuetypes.fields'
  );
  const subType = meta.projects?.[0]?.issuetypes?.find((t) => t.name === 'Sub-task');
  if (subType?.fields?.customfield_10193) {
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
      }
    }
  } catch (e) {
    console.warn('Sprint add skipped:', e instanceof Error ? e.message : e);
  }

  await transitionIssue(key, 'In Dev');

  await addComment(key, {
    type: 'doc',
    version: 1,
    content: [
      adfPara(
        'Remediation subtask created. Next: CPTSQL20 discovery spike (dummy encrypt/decrypt), then pilot on 1–2 flagged DBs before bulk run.'
      ),
    ],
  });

  await addComment(PARENT_KEY, {
    type: 'doc',
    version: 1,
    content: [adfPara(`Remediation work tracked on subtask ${key}.`)],
  });

  fs.writeFileSync(
    timingPath,
    JSON.stringify(
      {
        issueKey: key,
        parentKey: PARENT_KEY,
        parentId,
        taskStartUtc: TASK_START_UTC,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log(`Created ${key} under ${PARENT_KEY}`);
  console.log(browseUrl(key));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
