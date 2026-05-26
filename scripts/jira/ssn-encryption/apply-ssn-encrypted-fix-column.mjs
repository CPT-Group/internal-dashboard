/**
 * Add SSNEncryptedFix BIT to CleanClaims on flagged databases only.
 * Usage:
 *   node cursorScripts/jira/apply-ssn-encrypted-fix-column.mjs           # dry-run
 *   node cursorScripts/jira/apply-ssn-encrypted-fix-column.mjs --execute
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sql from 'mssql';
import { quoteIdent, cpt2k16PoolConfig, repoPaths } from './ssnEncryptionShared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');
dotenv.config({ path: path.join(root, '.env.local') });

const resultsPath = repoPaths(root).auditResults;
const ddlPath = path.join(__dirname, '..', '..', 'sql', 'add-ssn-encrypted-fix-column.sql');
const execute = process.argv.includes('--execute');

const ddl = fs.readFileSync(ddlPath, 'utf8');

function flaggedDatabases() {
  const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  return [...new Set(data.rows.filter((r) => r.unencryptedCount > 0).map((r) => r.database))].sort();
}

async function main() {
  const dbs = flaggedDatabases();
  console.log(`Flagged databases: ${dbs.length} | mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);

  const pool = await sql.connect(cpt2k16PoolConfig());
  const log = [];

  for (let i = 0; i < dbs.length; i += 1) {
    const db = dbs[i];
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${dbs.length}`);
    try {
      await pool.request().query(`USE ${quoteIdent(db)};`);
      const check = await pool.request().query(`
        SELECT COL_LENGTH('dbo.CleanClaims', 'SSNEncryptedFix') AS col_len;
      `);
      const exists = check.recordset[0]?.col_len != null;
      if (exists) {
        log.push({ database: db, status: 'exists' });
        continue;
      }
      if (!execute) {
        log.push({ database: db, status: 'would_add' });
        continue;
      }
      await pool.request().query(`USE ${quoteIdent(db)}; ${ddl}`);
      log.push({ database: db, status: 'added' });
    } catch (err) {
      log.push({
        database: db,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await pool.close();

  const out = path.join(__dirname, `ssn-marker-ddl-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(out, JSON.stringify(log, null, 2));
  const summary = log.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    {}
  );
  console.log('Summary:', summary);
  console.log('Wrote', out);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
