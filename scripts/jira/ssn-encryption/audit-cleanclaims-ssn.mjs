/**
 * Scan CPT2K16 databases with dbo.CleanClaims for plaintext SSN in ssn* columns.
 * Updates NOVA ticket from cursorScripts/jira/ssn-audit-timing.json.
 *
 * Usage: node cursorScripts/jira/audit-cleanclaims-ssn.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sql from 'mssql';
import {
  adfPara,
  adfHeading,
  adfTable,
  addComment,
  updateDescription,
  addWorklog,
  browseUrl,
} from './jiraClient.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');
dotenv.config({ path: path.join(root, '.env.local') });

const timingPath = path.join(__dirname, 'ssn-audit-timing.json');
const resultsPath = path.join(__dirname, 'ssn-audit-results.json');

const AUDIT_START_UTC = Math.floor(Date.now() / 1000);

/** @typedef {{ database: string; ssnColumn: string; totalRows: number; unencryptedCount: number; lastModified: string | null; error?: string }} AuditRow */

function poolConfig() {
  const server = process.env.DB_SERVER;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const port = parseInt(process.env.DB_PORT || '1433', 10);
  if (!server || !user || !password) {
    throw new Error('Missing DB_SERVER, DB_USER, or DB_PASSWORD in .env.local');
  }
  return {
    server,
    user,
    password,
    port,
    database: 'master',
    options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
    requestTimeout: 120000,
  };
}

function quoteIdent(name) {
  return `[${String(name).replace(/]/g, ']]')}]`;
}

function isSsnColumnName(name) {
  return /ssn/i.test(name);
}

/**
 * Plaintext SSN heuristic: 9 digits (optional dashes/spaces), no letters.
 */
function plaintextWhereClause(colQuoted) {
  const trimmed = `LTRIM(RTRIM(CAST(${colQuoted} AS NVARCHAR(4000))))`;
  const digitsOnly = `REPLACE(REPLACE(${trimmed}, '-', ''), ' ', '')`;
  return `
    ${colQuoted} IS NOT NULL
    AND ${trimmed} <> ''
    AND ${trimmed} NOT LIKE '%[A-Za-z]%'
    AND LEN(${digitsOnly}) = 9
    AND ${digitsOnly} NOT LIKE '%[^0-9]%'
  `;
}

async function listDatabasesWithCleanClaims(pool) {
  const result = await pool.request().query(`
    SELECT d.name
    FROM sys.databases d
    WHERE d.state_desc = 'ONLINE'
      AND d.name NOT IN ('master', 'tempdb', 'model', 'msdb')
    ORDER BY d.name;
  `);
  const names = result.recordset.map((r) => String(r.name));
  const withTable = [];
  for (const db of names) {
    const check = await pool.request().query(`
      SELECT 1 AS ok
      FROM ${quoteIdent(db)}.sys.tables t
      INNER JOIN ${quoteIdent(db)}.sys.schemas s ON t.schema_id = s.schema_id
      WHERE t.name = N'CleanClaims' AND s.name = N'dbo';
    `);
    if (check.recordset.length > 0) withTable.push(db);
  }
  return withTable;
}

async function getSsnColumns(pool, db) {
  const q = `
    SELECT c.name AS column_name, ty.name AS type_name
    FROM ${quoteIdent(db)}.sys.columns c
    INNER JOIN ${quoteIdent(db)}.sys.tables t ON c.object_id = t.object_id
    INNER JOIN ${quoteIdent(db)}.sys.schemas s ON t.schema_id = s.schema_id
    INNER JOIN ${quoteIdent(db)}.sys.types ty ON c.user_type_id = ty.user_type_id
    WHERE t.name = N'CleanClaims' AND s.name = N'dbo'
      AND c.name LIKE '%ssn%'
    ORDER BY c.column_id;
  `;
  const result = await pool.request().query(q);
  return result.recordset
    .map((r) => ({ name: String(r.column_name), typeName: String(r.type_name) }))
    .filter((c) => isSsnColumnName(c.name));
}

async function findModifiedColumn(pool, db) {
  const q = `
    SELECT TOP 1 c.name
    FROM ${quoteIdent(db)}.sys.columns c
    INNER JOIN ${quoteIdent(db)}.sys.tables t ON c.object_id = t.object_id
    INNER JOIN ${quoteIdent(db)}.sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = N'CleanClaims' AND s.name = N'dbo'
      AND (
        c.name IN (N'DateModified', N'ModifiedDate', N'LastModified', N'Updated', N'UpdateDate', N'DateUpdated')
        OR c.name LIKE '%Modif%'
        OR c.name LIKE '%Updated%'
      )
    ORDER BY
      CASE c.name
        WHEN N'DateModified' THEN 0
        WHEN N'ModifiedDate' THEN 1
        WHEN N'LastModified' THEN 2
        ELSE 10
      END,
      c.column_id;
  `;
  const result = await pool.request().query(q);
  return result.recordset[0] ? String(result.recordset[0].name) : null;
}

/** @returns {Promise<AuditRow[]>} */
async function auditDatabase(pool, db) {
  const columns = await getSsnColumns(pool, db);
  if (columns.length === 0) {
    return [
      {
        database: db,
        ssnColumn: '(none)',
        totalRows: 0,
        unencryptedCount: 0,
        lastModified: null,
        error: 'No ssn* columns on CleanClaims',
      },
    ];
  }

  const modCol = await findModifiedColumn(pool, db);
  const rows = [];

  for (const col of columns) {
    const colQ = `${quoteIdent(db)}.dbo.CleanClaims.${quoteIdent(col.name)}`;
    const wherePlain = plaintextWhereClause(colQ);
    const modSelect = modCol
      ? `, MAX(${quoteIdent(db)}.dbo.CleanClaims.${quoteIdent(modCol)}) AS last_modified`
      : '';

    try {
      const result = await pool.request().query(`
        SELECT
          COUNT(*) AS total_rows,
          SUM(CASE WHEN ${wherePlain} THEN 1 ELSE 0 END) AS unencrypted_count
          ${modSelect}
        FROM ${quoteIdent(db)}.dbo.CleanClaims;
      `);
      const r = result.recordset[0];
      rows.push({
        database: db,
        ssnColumn: col.name,
        totalRows: Number(r.total_rows) || 0,
        unencryptedCount: Number(r.unencrypted_count) || 0,
        lastModified: r.last_modified ? new Date(r.last_modified).toISOString() : null,
      });
    } catch (err) {
      rows.push({
        database: db,
        ssnColumn: col.name,
        totalRows: 0,
        unencryptedCount: 0,
        lastModified: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return rows;
}

function buildResultsDoc(rows, meta) {
  const flagged = rows.filter((r) => r.unencryptedCount > 0);
  const tableRows = rows
    .filter((r) => r.ssnColumn !== '(none)' || r.error)
    .sort((a, b) => b.unencryptedCount - a.unencryptedCount)
    .map((r) => [
      r.database,
      r.ssnColumn,
      r.unencryptedCount.toLocaleString(),
      r.totalRows.toLocaleString(),
      r.lastModified ? r.lastModified.slice(0, 10) : '—',
      r.error ? `⚠ ${r.error.slice(0, 40)}` : r.unencryptedCount > 0 ? 'REVIEW' : 'OK',
    ]);

  return {
    type: 'doc',
    version: 1,
    content: [
      adfPara(`Audit run: ${meta.runAt} (Pacific local server time from CPT2K16 scan).`),
      adfPara(
        `Databases with CleanClaims: ${meta.dbCount}. SSN columns scanned: ${meta.columnScans}. Rows with plaintext-pattern SSN: ${meta.totalUnencrypted.toLocaleString()}.`
      ),
      adfHeading(3, 'Summary'),
      adfPara(
        flagged.length === 0
          ? 'No plaintext-pattern SSN values detected with current heuristics.'
          : `${flagged.length} database/column pair(s) have one or more plaintext-pattern values — see table.`
      ),
      adfTable(
        ['Database', 'Column', 'Unencrypted', 'Total rows', 'Last modified (max)', 'Status'],
        tableRows.length > 0 ? tableRows : [['—', '—', '0', '0', '—', 'No data']]
      ),
      adfHeading(3, 'Heuristic'),
      adfPara(
        'Plaintext = non-empty value, no letters, exactly 9 digits after removing dashes/spaces. Encrypted or tokenized values typically fail this pattern.'
      ),
    ],
  };
}

async function main() {
  if (!fs.existsSync(timingPath)) {
    throw new Error(`Missing ${timingPath} — run create-ssn-audit-ticket.mjs first`);
  }
  const timing = JSON.parse(fs.readFileSync(timingPath, 'utf8'));
  const issueKey = timing.issueKey;
  if (!issueKey) throw new Error('issueKey missing in timing file');

  const pool = await sql.connect(poolConfig());
  console.log('Connected to CPT2K16 (master)');

  const databases = await listDatabasesWithCleanClaims(pool);
  console.log(`Found ${databases.length} database(s) with dbo.CleanClaims`);

  /** @type {AuditRow[]} */
  const allRows = [];
  let i = 0;
  for (const db of databases) {
    i += 1;
    process.stdout.write(`[${i}/${databases.length}] ${db} ... `);
    const list = await auditDatabase(pool, db);
    allRows.push(...list);
    const bad = list.reduce((s, r) => s + r.unencryptedCount, 0);
    console.log(bad > 0 ? `${bad} plaintext` : 'ok');
  }
  await pool.close();

  const totalUnencrypted = allRows.reduce((s, r) => s + r.unencryptedCount, 0);
  const runAt = new Date().toISOString();
  const meta = {
    runAt,
    dbCount: databases.length,
    columnScans: allRows.filter((r) => r.ssnColumn !== '(none)').length,
    totalUnencrypted,
    auditStartUtc: AUDIT_START_UTC,
  };

  fs.writeFileSync(resultsPath, JSON.stringify({ meta, rows: allRows }, null, 2));
  console.log(`Wrote ${resultsPath}`);

  const description = {
    type: 'doc',
    version: 1,
    content: [
      adfPara(
        'Periodic security audit: CPT2K16 dbo.CleanClaims — flag SSN-related columns stored as plaintext (9-digit / ###-##-#### pattern).'
      ),
      adfHeading(2, 'Latest results'),
      ...buildResultsDoc(allRows, meta).content.slice(1),
    ],
  };

  await updateDescription(issueKey, description);
  await addComment(issueKey, {
    type: 'doc',
    version: 1,
    content: [
      adfPara('Initial audit complete. Description updated with full results table.'),
      ...buildResultsDoc(allRows, meta).content,
    ],
  });

  const auditEndUtc = Math.floor(Date.now() / 1000);
  const elapsed = auditEndUtc - (timing.taskStartUtc ?? AUDIT_START_UTC);
  const startedIso = new Date((timing.taskStartUtc ?? AUDIT_START_UTC) * 1000).toISOString();

  await addWorklog(issueKey, {
    timeSpentSeconds: elapsed,
    started: (timing.taskStartUtc ?? AUDIT_START_UTC) * 1000,
    commentText: `CPT2K16 CleanClaims SSN audit: ${databases.length} DBs, ${totalUnencrypted} plaintext-pattern row(s).`,
  });

  timing.auditEndUtc = auditEndUtc;
  timing.elapsedSeconds = elapsed;
  fs.writeFileSync(timingPath, JSON.stringify(timing, null, 2));

  console.log(`\nUpdated ${issueKey}`);
  console.log(browseUrl(issueKey));
  console.log(`Worklog: ${elapsed}s`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
