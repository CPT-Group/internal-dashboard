/**
 * Remediate plaintext SSN on CleanClaims — updates ONLY target SSN column + SSNEncryptedFix.
 *
 * Usage:
 *   node scripts/jira/ssn-encryption/remediate-cleanclaims-ssn.mjs
 *   node scripts/jira/ssn-encryption/remediate-cleanclaims-ssn.mjs --database HomeDepot_Bell_O_SQL
 *   node scripts/jira/ssn-encryption/remediate-cleanclaims-ssn.mjs --execute --database HomeDepot_Bell_O_SQL --limit 5
 *   node scripts/jira/ssn-encryption/remediate-cleanclaims-ssn.mjs --export-manual-review
 *   node scripts/jira/ssn-encryption/remediate-cleanclaims-ssn.mjs --include-all-ssn-columns
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sql from 'mssql';
import {
  quoteIdent,
  cpt2k16PoolConfig,
  isPrimarySsnColumn,
  plaintextSqlExpr,
  repoPaths,
} from './ssnEncryptionShared.mjs';
import {
  encryptPlaintextSsn,
  hasMarkerColumn,
  buildCandidateSelectSql,
  buildStrictUpdateSql,
  countCandidates,
  isPlaintextSsnValue,
} from './ssnEncryptionPipeline.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');
dotenv.config({ path: path.join(root, '.env.local') });

const resultsPath = repoPaths(root).auditResults;
const stamp = new Date().toISOString().slice(0, 10);

const execute = process.argv.includes('--execute');
const exportManual = process.argv.includes('--export-manual-review');
const includeAllCols = process.argv.includes('--include-all-ssn-columns');
const dbFilter = (() => {
  const i = process.argv.indexOf('--database');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const limit = (() => {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : null;
})();

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
}

function loadWorkItems() {
  const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  let rows = data.rows.filter((r) => r.unencryptedCount > 0 && !r.error);
  if (!includeAllCols) rows = rows.filter((r) => isPrimarySsnColumn(r.ssnColumn));
  if (dbFilter) rows = rows.filter((r) => r.database === dbFilter);
  return rows;
}

async function exportManualReview(pool, db, ssnColumn) {
  const colQ = quoteIdent(ssnColumn);
  const { isManualReview } = plaintextSqlExpr(colQ);
  const result = await pool.request().query(`
    SELECT TOP 500 MailingListID AS pk, LEN(${colQ}) AS value_len
    FROM dbo.CleanClaims
    WHERE ${isManualReview}
  `);
  return result.recordset.map((r) => ({
    database: db,
    ssnColumn,
    pk: r.pk,
    valueLen: r.value_len,
    reason: 'non_empty_not_plaintext_9_digit',
  }));
}

async function remediatePair(database, ssnColumn) {
  const pool = await sql.connect({
    ...cpt2k16PoolConfig(),
    database,
  });

  const marker = await hasMarkerColumn(pool);
  if (!marker && execute) {
    throw new Error(`${database}: SSNEncryptedFix column missing — run apply-ssn-encrypted-fix-column.mjs --execute`);
  }

  const candidateCount = await countCandidates(pool, ssnColumn, marker);
  const rows = [];

  if (!execute) {
    await pool.close();
    return { database, ssnColumn, candidateCount, attempted: 0, succeeded: 0, failed: 0, dryRun: true };
  }

  const selectSql = buildCandidateSelectSql(ssnColumn, marker);
  const updateSql = buildStrictUpdateSql(ssnColumn);
  const candidates = await pool.request().query(
    limit != null ? selectSql.replace('SELECT', `SELECT TOP (${limit})`) : selectSql
  );

  for (const row of candidates.recordset) {
    const pk = row.pk;
    const plain = String(row.plain_value ?? '').trim();
    if (!isPlaintextSsnValue(plain)) {
      rows.push({ database, ssnColumn, pk, status: 'skipped_not_plaintext' });
      continue;
    }
    try {
      const encrypted = await encryptPlaintextSsn(pool, plain);
      await pool
        .request()
        .input('pk', sql.Int, pk)
        .input('encrypted', sql.NVarChar(50), encrypted)
        .query(updateSql);
      rows.push({ database, ssnColumn, pk, status: 'encrypted', at: new Date().toISOString() });
    } catch (err) {
      rows.push({
        database,
        ssnColumn,
        pk,
        status: 'error',
        error: err instanceof Error ? err.message.slice(0, 200) : String(err),
      });
    }
  }

  await pool.close();
  return {
    database,
    ssnColumn,
    candidateCount,
    attempted: candidates.recordset.length,
    succeeded: rows.filter((r) => r.status === 'encrypted').length,
    failed: rows.filter((r) => r.status === 'error').length,
    rows,
  };
}

async function main() {
  const items = loadWorkItems();
  console.log(
    `Mode: ${execute ? 'EXECUTE' : 'DRY-RUN'} | pairs: ${items.length} | db: ${dbFilter ?? 'all'} | primary cols only: ${!includeAllCols}`
  );

  if (exportManual) {
    const manual = [];
    const dbs = [...new Set(items.map((i) => i.database))];
    for (const db of dbs) {
      const pool = await sql.connect({ ...cpt2k16PoolConfig(), database: db });
      const cols = [...new Set(items.filter((i) => i.database === db).map((i) => i.ssnColumn))];
      for (const col of cols) {
        manual.push(...(await exportManualReview(pool, db, col)));
      }
      await pool.close();
    }
    const p = path.join(__dirname, `ssn-remediation-manual-review-${stamp}.csv`);
    writeCsv(p, ['database', 'ssnColumn', 'pk', 'valueLen', 'reason'], manual);
    console.log(`Wrote ${p} (${manual.length} rows)`);
    return;
  }

  const executed = [];
  const errors = [];
  let totalCandidates = 0;

  for (const item of items) {
    process.stdout.write(`${item.database}.${item.ssnColumn} ... `);
    try {
      const result = await remediatePair(item.database, item.ssnColumn);
      totalCandidates += result.candidateCount;
      console.log(
        result.dryRun
          ? `${result.candidateCount} candidates`
          : `${result.succeeded}/${result.attempted} ok`
      );
      if (result.rows) executed.push(...result.rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log('ERR', msg.slice(0, 80));
      errors.push({ database: item.database, ssnColumn: item.ssnColumn, error: msg });
    }
  }

  const execPath = path.join(__dirname, `ssn-remediation-executed-${stamp}.csv`);
  const errPath = path.join(__dirname, `ssn-remediation-errors-${stamp}.csv`);
  if (executed.length) {
    writeCsv(execPath, ['database', 'ssnColumn', 'pk', 'status', 'at', 'error'], executed);
    console.log('Wrote', execPath);
  }
  if (errors.length) {
    writeCsv(errPath, ['database', 'ssnColumn', 'error'], errors);
    console.log('Wrote', errPath);
  }

  console.log(`Total plaintext candidates (dry-run sum): ${totalCandidates}`);
  if (!execute) {
    console.log('\nNo rows modified. Use --execute after SSN_ENCRYPT_SQL is configured and DDL applied.');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
