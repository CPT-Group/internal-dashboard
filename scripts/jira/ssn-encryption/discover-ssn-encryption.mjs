/**
 * Discover CPTSQL20 + CPT2K16 SSN encryption pipeline.
 * Usage: node cursorScripts/jira/discover-ssn-encryption.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sql from 'mssql';
import { quoteIdent, cpt2k16PoolConfig, cptsql20PoolConfig } from './ssnEncryptionShared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');
dotenv.config({ path: path.join(root, '.env.local') });

const outJson = path.join(__dirname, 'ssn-encryption-discovery.json');
const outDoc = path.join(root, 'docs', 'cleanclaims-ssn-encryption.md');
const configPath = path.join(__dirname, 'ssn-encryption-config.json');

const SAMPLE_DBS = [
  'PackagingPlusJacoboClaimsSQL',
  'HomeDepot_Bell_O_SQL',
  'JPMorganChaseHightowerClaimsSQL',
];

const DUMMY = '123456789';

async function listProcs(pool, dbName) {
  const from = dbName
    ? `${quoteIdent(dbName)}.sys.objects o INNER JOIN ${quoteIdent(dbName)}.sys.schemas s ON o.schema_id = s.schema_id`
    : `sys.objects o INNER JOIN sys.schemas s ON o.schema_id = s.schema_id`;
  const r = await pool.request().query(`
    SELECT s.name AS schema_name, o.name AS object_name, o.type_desc
    FROM ${from}
    WHERE o.type IN ('P', 'PC', 'FN', 'IF', 'TF')
      AND (o.name LIKE '%SSN%' OR o.name LIKE '%Encrypt%' OR o.name LIKE '%Decrypt%' OR o.name LIKE '%Crypt%')
    ORDER BY o.name;
  `);
  return r.recordset.map((row) => ({
    schema: String(row.schema_name),
    name: String(row.object_name),
    qualified: `${row.schema_name}.${row.object_name}`,
  }));
}

async function discoverCptSql20Direct() {
  const report = { connectionOk: false, databases: {} };
  for (const db of ['master', 'CPTMaster', 'Encryption', 'CPTEncryption']) {
    try {
      const pool = await sql.connect(cptsql20PoolConfig(db));
      report.connectionOk = true;
      report.databases[db] = { procs: await listProcs(pool, null) };
      await pool.close();
    } catch (err) {
      report.databases[db] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return report;
}

async function discoverLinkedServer(pool) {
  const linked = await pool.request().query(`
    SELECT name, data_source FROM sys.servers WHERE is_linked = 1 ORDER BY name;
  `);
  const cptsql20Procs = [];
  for (const ls of ['CPTSQL20', 'cptsql20\\sqlexpress']) {
    try {
      const inner = `SELECT s.name AS schema_name, o.name AS object_name FROM sys.objects o JOIN sys.schemas s ON o.schema_id = s.schema_id WHERE o.type IN ('P','PC','FN') AND (o.name LIKE '%Encrypt%' OR o.name LIKE '%SSN%') ORDER BY o.name`;
      const r = await pool.request().query(
        `SELECT * FROM OPENQUERY([${ls}], '${inner.replace(/'/g, "''")}')`
      );
      cptsql20Procs.push({ linkedServer: ls, procs: r.recordset });
    } catch (err) {
      cptsql20Procs.push({
        linkedServer: ls,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { linkedServers: linked.recordset, cptsql20Procs };
}

async function discoverCptMaster(pool) {
  const procs = await listProcs(pool, 'CPTMaster');
  const encryptTest = await pool.request().query(`
    SELECT
      dbo.EncryptSSN(N'${DUMMY}') AS legacy_encrypt,
      LEN(dbo.EncryptSSN(N'${DUMMY}')) AS legacy_len;
  `);
  const sampleEncrypted = await pool.request().query(`
    SELECT TOP 1 LEN(SSN) AS ssn_len
    FROM PackagingPlusJacoboClaimsSQL.dbo.CleanClaims
    WHERE SSN IS NOT NULL AND LEN(LTRIM(RTRIM(SSN))) = 35;
  `);
  return { procs, encryptTest: encryptTest.recordset[0], productionEncryptedLen: sampleEncrypted.recordset[0]?.ssn_len };
}

async function discoverCaseDb(pool, db) {
  const procs = await listProcs(pool, db);
  let viewDef = null;
  try {
    const r = await pool.request().query(`
      SELECT m.definition
      FROM ${quoteIdent(db)}.sys.sql_modules m
      JOIN ${quoteIdent(db)}.sys.objects o ON m.object_id = o.object_id
      WHERE o.name = N'vwShowSSNsInClaimsNotEncrypted';
    `);
    viewDef = r.recordset[0]?.definition ? String(r.recordset[0].definition).slice(0, 500) : null;
  } catch {
    /* skip */
  }
  return { procs, vwShowSSNsInClaimsNotEncrypted: viewDef };
}

function renderDoc(d) {
  return `# CleanClaims SSN encryption (CPTSQL20 pipeline)

**Jira:** NOVA-2451 (audit) · NOVA-2454 (remediation)

## Critical rule

Remediation **only** updates:

1. The specific SSN column being fixed (e.g. \`SSN\`, \`ssnString\`)
2. \`SSNEncryptedFix\` (BIT traceability)

**No other \`CleanClaims\` columns are modified.**

## Production encrypted shape

- **Length:** 35 characters (hex-style), per \`vwShowSSNsInClaimsNotEncrypted\` (\`len(ssn) between 1 and 34\` = treat as not encrypted).
- **Do not use** \`CPTMaster.dbo.EncryptSSN\` for remediation — legacy letter-substitution UDF; does not produce the 35-char value.

## Servers

| Server | Auth | Role |
|--------|------|------|
| CPT2K16 | \`DB_*\` in \`.env.local\` | Case DBs, remediation \`UPDATE\` |
| CPTSQL20 | Windows integrated (workstation) | Encrypt service; linked server \`CPTSQL20\` from CPT2K16 |

## Configure encrypt (required for \`--execute\`)

Set on workstation (not committed):

\`\`\`bash
# SQL run on CPT2K16; must accept @plain and return column \`encrypted\`
SSN_ENCRYPT_SQL="SELECT ... AS encrypted"
\`\`\`

Complete CPTSQL20 spike on a domain-joined machine, then paste the working call here.

## Scripts

| Script | Purpose |
|--------|---------|
| \`discover-ssn-encryption.mjs\` | Refresh discovery JSON + this doc |
| \`apply-ssn-encrypted-fix-column.mjs\` | Add \`SSNEncryptedFix\` (155 flagged DBs) |
| \`remediate-cleanclaims-ssn.mjs\` | Dry-run / execute (SSN column + flag only) |

## Discovery snapshot

- **Generated:** ${d.generatedAt}
- **CPTSQL20 direct (Windows auth):** ${d.cptsql20Direct.connectionOk ? 'connected' : 'failed — use linked server or VPN workstation'}
- **CPT2K16 linked server CPTSQL20:** see \`ssn-encryption-discovery.json\`
- **CPTMaster legacy EncryptSSN test len:** ${d.cptMaster?.encryptTest?.legacy_len ?? 'n/a'}
- **Sample production encrypted len:** ${d.cptMaster?.productionEncryptedLen ?? 'n/a'}

## Default column scope

First pass: \`SSN\`, \`ssnString\`, \`SSNString\` only. Use \`--include-all-ssn-columns\` for \`W9SSN\` etc. after sign-off.
`;
}

async function main() {
  let cptsql20Direct = { connectionOk: false, databases: {}, error: null };
  try {
    cptsql20Direct = await discoverCptSql20Direct();
  } catch (err) {
    cptsql20Direct.error = err instanceof Error ? err.message : String(err);
  }

  const pool = await sql.connect(cpt2k16PoolConfig());
  let linked = { linkedServers: [], cptsql20Procs: [] };
  let cptMaster = null;
  const samples = [];

  try {
    linked = await discoverLinkedServer(pool);
    cptMaster = await discoverCptMaster(pool);
    for (const db of SAMPLE_DBS) {
      samples.push({ database: db, ...(await discoverCaseDb(pool, db)) });
    }
  } finally {
    await pool.close();
  }

  const discovery = {
    generatedAt: new Date().toISOString(),
    cptsql20Direct,
    cpt2k16: { ...linked, samples },
    cptMaster,
    dummySsn: DUMMY,
  };

  fs.writeFileSync(outJson, JSON.stringify(discovery, null, 2));
  fs.writeFileSync(outDoc, renderDoc(discovery));

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  cfg.updatedAt = discovery.generatedAt;
  cfg.discoveryNotes = {
    cptsql20DirectOk: cptsql20Direct.connectionOk,
    productionEncryptedLen: cptMaster.productionEncryptedLen,
    legacyEncryptLen: cptMaster.encryptTest?.legacy_len,
  };
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

  console.log('Wrote', outJson, outDoc);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
