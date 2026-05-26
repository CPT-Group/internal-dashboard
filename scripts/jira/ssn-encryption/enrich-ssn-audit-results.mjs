/**
 * Enrich ssn-audit-results.json: DB activity dates, encrypted/empty counts.
 * Usage: node cursorScripts/jira/enrich-ssn-audit-results.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sql from 'mssql';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');
dotenv.config({ path: path.join(root, '.env.local') });

const resultsPath = path.join(__dirname, 'ssn-audit-results.json');

function quoteIdent(name) {
  return `[${String(name).replace(/]/g, ']]')}]`;
}

function poolConfig() {
  return {
    server: process.env.DB_SERVER,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: 'master',
    options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
    requestTimeout: 120000,
  };
}

function plaintextSqlExpr(colQuoted) {
  const trimmed = `LTRIM(RTRIM(CAST(${colQuoted} AS NVARCHAR(4000))))`;
  const digitsOnly = `REPLACE(REPLACE(${trimmed}, '-', ''), ' ', '')`;
  const isPlain = `
    (${colQuoted} IS NOT NULL
     AND ${trimmed} <> ''
     AND ${trimmed} NOT LIKE '%[A-Za-z]%'
     AND LEN(${digitsOnly}) = 9
     AND ${digitsOnly} NOT LIKE '%[^0-9]%')
  `;
  const isEmpty = `(${colQuoted} IS NULL OR ${trimmed} = '')`;
  return { isPlain, isEmpty, trimmed };
}

/** @returns {Promise<Date | null>} */
async function getDbActivityDate(pool, db) {
  const dbLit = db.replace(/'/g, "''");
  try {
    const meta = await pool.request().query(`
      SELECT
        o.modify_date AS table_modify_date,
        o.create_date AS table_create_date,
        d.create_date AS database_create_date
      FROM ${quoteIdent(db)}.sys.objects o
      INNER JOIN sys.databases d ON d.name = N'${dbLit}'
      WHERE o.object_id = OBJECT_ID(N'${dbLit}.dbo.CleanClaims');
    `);
    const row = meta.recordset[0];
    if (!row) return null;
    const dates = [row.table_modify_date, row.table_create_date, row.database_create_date]
      .filter(Boolean)
      .map((d) => new Date(d));
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  } catch {
    return null;
  }
}

/** @returns {Promise<string | null>} */
async function getMaxCleanClaimsRowDate(pool, db) {
  const dbQ = quoteIdent(db);
  const cols = await pool.request().query(`
    SELECT c.name, ty.name AS type_name
    FROM ${dbQ}.sys.columns c
    INNER JOIN ${dbQ}.sys.tables t ON c.object_id = t.object_id
    INNER JOIN ${dbQ}.sys.schemas s ON t.schema_id = s.schema_id
    INNER JOIN ${dbQ}.sys.types ty ON c.user_type_id = ty.user_type_id
    WHERE t.name = N'CleanClaims' AND s.name = N'dbo'
      AND ty.name IN ('date', 'datetime', 'datetime2', 'smalldatetime', 'datetimeoffset');
  `);
  const names = cols.recordset.map((r) => String(r.name));
  if (names.length === 0) return null;

  const unions = names
    .map((n) => `SELECT MAX(${quoteIdent(n)}) AS dt FROM ${dbQ}.dbo.CleanClaims`)
    .join(' UNION ALL ');
  try {
    const result = await pool.request().query(`SELECT MAX(dt) AS max_row_date FROM (${unions}) AS all_dates;`);
    const v = result.recordset[0]?.max_row_date;
    return v ? new Date(v).toISOString() : null;
  } catch {
    return null;
  }
}

async function countSsnColumn(pool, db, colName) {
  const colQ = `${quoteIdent(db)}.dbo.CleanClaims.${quoteIdent(colName)}`;
  const { isPlain, isEmpty } = plaintextSqlExpr(colQ);
  const result = await pool.request().query(`
    SELECT
      COUNT(*) AS total_rows,
      SUM(CASE WHEN ${isPlain} THEN 1 ELSE 0 END) AS plaintext_count,
      SUM(CASE WHEN NOT ${isEmpty} AND NOT ${isPlain} THEN 1 ELSE 0 END) AS encrypted_count,
      SUM(CASE WHEN ${isEmpty} THEN 1 ELSE 0 END) AS empty_count
    FROM ${quoteIdent(db)}.dbo.CleanClaims;
  `);
  const r = result.recordset[0];
  return {
    totalRows: Number(r.total_rows) || 0,
    unencryptedCount: Number(r.plaintext_count) || 0,
    encryptedCount: Number(r.encrypted_count) || 0,
    emptyCount: Number(r.empty_count) || 0,
  };
}

function maxIso(dates) {
  const parsed = dates.filter(Boolean).map((d) => new Date(d)).filter((d) => !Number.isNaN(d.getTime()));
  if (parsed.length === 0) return null;
  return new Date(Math.max(...parsed.map((d) => d.getTime()))).toISOString();
}

async function main() {
  const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const pool = await sql.connect(poolConfig());

  const dbDates = new Map();
  const uniqueDbs = [...new Set(data.rows.map((r) => r.database))];
  console.log(`Fetching activity dates for ${uniqueDbs.length} databases...`);

  let di = 0;
  for (const db of uniqueDbs) {
    di += 1;
    if (di % 200 === 0) process.stdout.write(`  dates ${di}/${uniqueDbs.length}\n`);
    const tableMeta = await getDbActivityDate(pool, db);
    const rowMax = await getMaxCleanClaimsRowDate(pool, db);
    dbDates.set(
      db,
      maxIso([tableMeta?.toISOString(), rowMax])
    );
  }

  console.log('Re-counting SSN columns (plaintext / encrypted / empty)...');
  let ri = 0;
  for (const row of data.rows) {
    ri += 1;
    if (ri % 500 === 0) process.stdout.write(`  counts ${ri}/${data.rows.length}\n`);

    row.lastModified = dbDates.get(row.database) ?? null;
    row.lastModifiedSource = 'CleanClaims table metadata + max datetime column on CleanClaims';

    if (row.error) continue;

    try {
      const counts = await countSsnColumn(pool, row.database, row.ssnColumn);
      row.totalRows = counts.totalRows;
      row.unencryptedCount = counts.unencryptedCount;
      row.encryptedCount = counts.encryptedCount;
      row.emptyCount = counts.emptyCount;
      delete row.error;
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
    }
  }

  await pool.close();

  const scansWithError = data.rows.filter((r) => r.error).length;
  const totalPlaintext = data.rows.reduce((s, r) => s + (r.unencryptedCount || 0), 0);
  const totalEncrypted = data.rows.reduce((s, r) => s + (r.encryptedCount || 0), 0);
  const totalEmpty = data.rows.reduce((s, r) => s + (r.emptyCount || 0), 0);
  const totalCellsChecked = totalPlaintext + totalEncrypted + totalEmpty;
  const pairsWithPlaintext = data.rows.filter((r) => r.unencryptedCount > 0).length;
  const dbRowTotals = new Map();
  for (const r of data.rows) {
    const prev = dbRowTotals.get(r.database) ?? 0;
    if (r.totalRows > prev) dbRowTotals.set(r.database, r.totalRows);
  }
  const cleanClaimsRowsDeduped = [...dbRowTotals.values()].reduce((s, n) => s + n, 0);

  data.meta = {
    ...data.meta,
    enrichedAt: new Date().toISOString(),
    scansTotal: data.rows.length,
    scansWithError,
    scansCompleted: data.rows.length - scansWithError,
    pairsWithPlaintext,
    totalPlaintext,
    totalEncrypted,
    totalEmpty,
    totalCellsChecked,
    cleanClaimsRowsDeduped,
    databasesWithCleanClaims: uniqueDbs.length,
  };

  fs.writeFileSync(resultsPath, JSON.stringify(data, null, 2));
  console.log('Enriched', resultsPath);
  console.log(JSON.stringify(data.meta, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
