/**
 * Shared SSN audit/remediation helpers (scripts/jira/ssn-encryption).
 */
import path from 'node:path';

export function repoPaths(rootDir) {
  const auditResults =
    process.env.SSN_AUDIT_RESULTS_PATH ??
    path.join(rootDir, 'cursorScripts', 'jira', 'ssn-audit-results.json');
  return {
    auditResults,
    encryptTiming: path.join(rootDir, 'cursorScripts', 'jira', 'ssn-encrypt-timing.json'),
    auditTiming: path.join(rootDir, 'cursorScripts', 'jira', 'ssn-audit-timing.json'),
    discoveryJson: path.join(rootDir, 'scripts', 'jira', 'ssn-encryption', 'ssn-encryption-discovery.json'),
    configJson: path.join(rootDir, 'scripts', 'jira', 'ssn-encryption', 'ssn-encryption-config.json'),
  };
}

export const PRIMARY_SSN_COLUMNS = new Set(['SSN', 'ssnString', 'SSNString']);

export function quoteIdent(name) {
  return `[${String(name).replace(/]/g, ']]')}]`;
}

export function isPrimarySsnColumn(name) {
  return PRIMARY_SSN_COLUMNS.has(name);
}

/** Plaintext SSN: 9 digits after removing dashes/spaces; no letters. */
export function plaintextSqlExpr(colQuoted) {
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
  const isManualReview = `(NOT ${isEmpty} AND NOT ${isPlain})`;
  return { isPlain, isEmpty, isManualReview, trimmed };
}

export function cpt2k16PoolConfig() {
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

export function cptsql20PoolConfig(database) {
  const server = process.env.ENCRYPT_SQL_SERVER || 'CPTSQL20';
  const db = database || process.env.ENCRYPT_SQL_DATABASE || 'master';
  return {
    server,
    database: db,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
      trustedConnection: true,
    },
    requestTimeout: 120000,
  };
}

export function loadFlaggedDatabases(resultsPath, readFileSync) {
  const data = JSON.parse(readFileSync(resultsPath, 'utf8'));
  const flagged = data.rows.filter((r) => r.unencryptedCount > 0 && !r.error);
  const uniqueDbs = [...new Set(flagged.map((r) => r.database))].sort();
  return { meta: data.meta, flagged, uniqueDbs };
}
