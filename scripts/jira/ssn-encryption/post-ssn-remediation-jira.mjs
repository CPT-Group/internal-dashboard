/**
 * Post formatted Jira update on NOVA-2454 (panels, tables).
 * Usage: node cursorScripts/jira/post-ssn-remediation-jira.mjs [comment|description]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  adfPara,
  adfHeading,
  adfBulletList,
  adfTable,
  adfPanel,
  addComment,
  updateDescription,
  jira,
} from './jiraClient.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const timingPath = path.join(__dirname, 'ssn-encrypt-timing.json');
const discoveryPath = path.join(__dirname, 'ssn-encryption-discovery.json');
const resultsPath = path.join(__dirname, 'ssn-audit-results.json');

const ROYR_ACCOUNT_ID = '712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f';

function buildStatusDoc(extra = {}) {
  const timing = JSON.parse(fs.readFileSync(timingPath, 'utf8'));
  const audit = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const discovery = fs.existsSync(discoveryPath)
    ? JSON.parse(fs.readFileSync(discoveryPath, 'utf8'))
    : {};

  const m = audit.meta;
  const pilot = extra.pilot ?? {};

  return {
    type: 'doc',
    version: 1,
    content: [
      adfPanel(
        'info',
        adfHeading(3, 'Update rule (strict)'),
        adfPara(
          'Remediation only updates the target SSN column (e.g. SSN) and SSNEncryptedFix = 1. No other CleanClaims columns are touched.'
        )
      ),
      adfPanel(
        'warning',
        adfHeading(3, 'Encrypt pipeline gate'),
        adfPara(
          discovery.cptsql20Direct?.connectionOk
            ? 'CPTSQL20 direct auth succeeded on last discovery run.'
            : 'CPTSQL20 direct Windows auth failed from automation — set SSN_ENCRYPT_SQL after manual CPTSQL20 spike before --execute.'
        ),
        adfBulletList([
          'Production encrypted SSN length: 35 (hex).',
          'Do not use CPTMaster.dbo.EncryptSSN (legacy; wrong format).',
          'Linked server CPTSQL20 is available from CPT2K16.',
        ])
      ),
      adfHeading(2, 'Audit baseline (parent NOVA-2451)'),
      adfTable(
        ['Measure', 'Count'],
        [
          ['Plaintext-pattern cells', (m.totalPlaintext ?? 0).toLocaleString()],
          ['Flagged databases', String(new Set(audit.rows.filter((r) => r.unencryptedCount > 0).map((r) => r.database)).size)],
          ['DB/column pairs (plaintext > 0)', String(audit.rows.filter((r) => r.unencryptedCount > 0).length)],
        ]
      ),
      adfHeading(2, 'Remediation progress'),
      adfTable(
        ['Item', 'Status'],
        [
          ['Scripts in repo', 'discover / apply marker / remediate'],
          ['SSNEncryptedFix DDL', extra.ddlSummary ?? 'dry-run ready'],
          ['Pilot dry-run', pilot.summary ?? 'pending'],
          ['Production --execute', 'blocked until SSN_ENCRYPT_SQL configured'],
        ]
      ),
      ...(pilot.detail
        ? [adfPanel('success', adfHeading(3, 'Pilot dry-run'), adfPara(pilot.detail))]
        : []),
      adfPanel(
        'note',
        adfPara(
          'Next: Kyle completes CPTSQL20 encrypt/decrypt spike, sets SSN_ENCRYPT_SQL, then pilot --execute on 1–2 DBs before bulk.'
        )
      ),
    ],
  };
}

async function main() {
  const mode = process.argv[2] ?? 'comment';
  const timing = JSON.parse(fs.readFileSync(timingPath, 'utf8'));
  const issueKey = timing.issueKey ?? 'NOVA-2454';

  let pilot = {};
  const pilotFiles = fs
    .readdirSync(__dirname)
    .filter((f) => f.startsWith('ssn-remediation-pilot-') && f.endsWith('.json'));
  if (pilotFiles.length > 0) {
    const latest = pilotFiles.sort().at(-1);
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, latest), 'utf8'));
    pilot = {
      summary: `${data.totalCandidates ?? 0} plaintext candidates (dry-run)`,
      detail: `Databases: ${(data.databases ?? []).join(', ')}. Mode: ${data.mode}.`,
    };
  }

  const doc = buildStatusDoc({ pilot, ddlSummary: 'see apply-ssn-encrypted-fix-column.mjs' });

  if (mode === 'description') {
    await updateDescription(issueKey, doc);
    console.log('Updated description on', issueKey);
  } else {
    await addComment(issueKey, doc);
    console.log('Comment on', issueKey);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
