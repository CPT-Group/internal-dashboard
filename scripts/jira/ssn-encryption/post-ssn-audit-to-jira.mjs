/**
 * Replace NOVA SSN audit attachments + description with aggregate summary + full CSV.
 * Usage: node cursorScripts/jira/post-ssn-audit-to-jira.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  browseUrl,
  jira,
  adfPara,
  adfHeading,
  adfTable,
  adfBulletList,
  updateDescription,
  addComment,
} from './jiraClient.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsPath = path.join(__dirname, 'ssn-audit-results.json');
const timingPath = path.join(__dirname, 'ssn-audit-timing.json');

const baseUrl = (process.env.JIRA_BASE_URL || 'https://cptgroup.atlassian.net').replace(/\/$/, '');
const email = process.env.KYLE_EMAIL;
const token = process.env.KYLE_JIRA_TOKEN;
const auth = Buffer.from(`${email}:${token}`).toString('base64');

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows, headers) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\r\n');
}

async function listAttachments(issueKey) {
  const issue = await jira(`/issue/${issueKey}?fields=attachment`);
  return issue.fields?.attachment ?? [];
}

async function deleteAttachment(attachmentId) {
  const res = await fetch(`${baseUrl}/rest/api/3/attachment/${attachmentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete attachment ${attachmentId}: ${res.status} ${text.slice(0, 200)}`);
  }
}

async function uploadAttachment(issueKey, filePath, fileName) {
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'text/csv' }), fileName);
  const res = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/attachments`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'X-Atlassian-Token': 'no-check' },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function buildDescription(meta) {
  const m = (n) => (n ?? 0).toLocaleString();
  const summaryRows = [
    ['Databases with dbo.CleanClaims', m(meta.databasesWithCleanClaims)],
    ['SSN-related columns scanned', m(meta.columnScans ?? meta.scansTotal)],
    ['Scans completed successfully', m(meta.scansCompleted)],
    ['Scans with errors', m(meta.scansWithError)],
    ['DB/column pairs with ≥1 plaintext value', m(meta.pairsWithPlaintext)],
    ['CleanClaims table rows (deduped per database)', m(meta.cleanClaimsRowsDeduped)],
    ['SSN cells checked (all columns)', m(meta.totalCellsChecked)],
    ['Plaintext-pattern values', m(meta.totalPlaintext)],
    ['Encrypted-pattern values (non-empty, not plaintext)', m(meta.totalEncrypted)],
    ['Empty / null SSN cells', m(meta.totalEmpty)],
  ];

  return {
    type: 'doc',
    version: 1,
    content: [
      adfHeading(1, 'Issue'),
      adfPara(
        'CPT2K16 case databases store claimant SSN data in dbo.CleanClaims (columns such as SSN, ssnString, W9SSN, etc.). Values must be encrypted at rest. We need a periodic audit of every database that has CleanClaims to find columns still holding plaintext (9-digit or ###-##-#### pattern) and remediate them.'
      ),
      adfHeading(2, 'What needs to be done'),
      adfBulletList([
        'Scan all online CPT2K16 databases with dbo.CleanClaims.',
        'For each column whose name contains "ssn", classify values: plaintext, encrypted (non-empty, not plaintext), or empty.',
        'Track databases that fail to scan (permissions, schema, timeouts).',
        'Prioritize remediation on pairs with plaintext counts > 0 (see attached CSV).',
        'Re-run this audit periodically after fixes.',
      ]),
      adfHeading(2, 'What we did (initial pass)'),
      adfPara(
        `Read-only scan on CPT2K16 (${meta.runAt?.slice(0, 10) ?? 'see CSV'}). Heuristic: plaintext = non-empty, no letters, exactly 9 digits after removing dashes/spaces. Encrypted = any other non-empty value. Last activity date per database = latest of CleanClaims table modify/create metadata and MAX() across datetime columns on CleanClaims.`
      ),
      adfHeading(2, 'Findings summary'),
      adfTable(['Measure', 'Count'], summaryRows),
      adfHeading(3, 'Attachment'),
      adfPara(
        'cleanclaims-ssn-audit.csv — every database × SSN column scan, sorted by plaintext count descending (highest risk first).'
      ),
      adfHeading(3, 'Notes'),
      adfBulletList([
        'One database with multiple SSN columns produces multiple scan rows; cell totals sum across columns.',
        'Columns like W9SSN or Rep1SSNOrTaxID may include false positives — validate before migration.',
        'Empty/null cells are not a security finding but are included in "cells checked".',
      ]),
    ],
  };
}

async function main() {
  if (!fs.existsSync(resultsPath)) {
    throw new Error(`Missing ${resultsPath}`);
  }
  const timing = JSON.parse(fs.readFileSync(timingPath, 'utf8'));
  const issueKey = timing.issueKey ?? 'NOVA-2451';

  const { meta, rows } = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const sorted = [...rows].sort((a, b) => {
    const d = (b.unencryptedCount || 0) - (a.unencryptedCount || 0);
    if (d !== 0) return d;
    return a.database.localeCompare(b.database);
  });

  const stamp = (meta.enrichedAt ?? meta.runAt ?? new Date().toISOString()).slice(0, 10);
  const csvHeaders = [
    'database',
    'ssnColumn',
    'plaintextCount',
    'encryptedCount',
    'emptyCount',
    'totalRowsInTable',
    'dbLastActivity',
    'scanError',
  ];
  const csvRows = sorted.map((r) => ({
    database: r.database,
    ssnColumn: r.ssnColumn,
    plaintextCount: r.unencryptedCount ?? 0,
    encryptedCount: r.encryptedCount ?? 0,
    emptyCount: r.emptyCount ?? 0,
    totalRowsInTable: r.totalRows ?? 0,
    dbLastActivity: r.lastModified ? r.lastModified.slice(0, 19) : '',
    scanError: r.error ?? '',
  }));

  const csvPath = path.join(__dirname, `cleanclaims-ssn-audit-${stamp}.csv`);
  fs.writeFileSync(csvPath, rowsToCsv(csvRows, csvHeaders), 'utf8');
  console.log(`Wrote ${csvPath} (${sorted.length} rows)`);

  const attachments = await listAttachments(issueKey);
  for (const att of attachments) {
    if (/cleanclaims-ssn-audit/i.test(att.filename ?? '')) {
      await deleteAttachment(att.id);
      console.log(`Deleted attachment: ${att.filename}`);
    }
  }

  const csvName = `cleanclaims-ssn-audit-${stamp}.csv`;
  await uploadAttachment(issueKey, csvPath, csvName);
  console.log(`Uploaded ${csvName}`);

  const description = buildDescription(meta);
  await updateDescription(issueKey, description);
  console.log('Replaced description');

  await addComment(issueKey, {
    type: 'doc',
    version: 1,
    content: [
      adfPara('Audit results refreshed — replaced prior CSVs and description.'),
      ...description.content.slice(2),
    ],
  });
  console.log('Added refresh comment');
  console.log(browseUrl(issueKey));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
