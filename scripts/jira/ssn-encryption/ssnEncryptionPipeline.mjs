/**
 * SSN encrypt pipeline + strict single-column UPDATE helpers.
 * Remediation only sets: [ssnColumn] = encrypted, SSNEncryptedFix = 1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { quoteIdent, plaintextSqlExpr } from './ssnEncryptionShared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, 'ssn-encryption-config.json');

export function loadEncryptionConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/** @param {string} value */
export function isPlaintextSsnValue(value) {
  if (value == null) return false;
  const trimmed = String(value).trim();
  if (!trimmed || /[A-Za-z]/.test(trimmed)) return false;
  const digits = trimmed.replace(/[-\s]/g, '');
  return digits.length === 9 && /^\d{9}$/.test(digits);
}

/** @param {string} value */
export function isEncryptedSsnShape(value) {
  if (value == null) return false;
  const trimmed = String(value).trim();
  const len = loadEncryptionConfig().encryptedSsnLength ?? 35;
  return trimmed.length === len && /^[0-9A-Fa-f]+$/.test(trimmed);
}

/**
 * Encrypt via SSN_ENCRYPT_SQL on CPT2K16. SQL must use @plain and return column `encrypted`.
 * @param {import('mssql').ConnectionPool} pool
 * @param {string} plaintext nine-digit SSN (no dashes required)
 */
export async function encryptPlaintextSsn(pool, plaintext) {
  const digits = String(plaintext).replace(/[-\s]/g, '');
  if (!/^\d{9}$/.test(digits)) {
    throw new Error('encryptPlaintextSsn: value is not 9-digit plaintext');
  }

  const sqlText = process.env.SSN_ENCRYPT_SQL?.trim();
  if (!sqlText) {
    throw new Error(
      'SSN_ENCRYPT_SQL is not set. Complete CPTSQL20 discovery and set env before --execute. See docs/cleanclaims-ssn-encryption.md'
    );
  }

  const result = await pool.request().input('plain', sql.NVarChar(20), digits).query(sqlText);
  const row = result.recordset?.[0];
  if (!row || row.encrypted == null) {
    throw new Error('SSN_ENCRYPT_SQL returned no encrypted column');
  }
  const encrypted = String(row.encrypted).trim();
  if (!isEncryptedSsnShape(encrypted)) {
    throw new Error(
      `Encrypt output failed shape check (expected len ${loadEncryptionConfig().encryptedSsnLength} hex, got len ${encrypted.length})`
    );
  }
  return encrypted;
}

/**
 * Build SELECT for remediation candidates — plaintext only, not yet flagged fixed.
 * @param {string} ssnColumn
 * @param {boolean} hasMarkerCol
 */
export function buildCandidateSelectSql(ssnColumn, hasMarkerCol) {
  const colQ = quoteIdent(ssnColumn);
  const { isPlain } = plaintextSqlExpr(colQ);
  const marker = hasMarkerCol ? 'AND ISNULL(SSNEncryptedFix, 0) = 0' : '';
  return `
    SELECT MailingListID AS pk, ${colQ} AS plain_value
    FROM dbo.CleanClaims
    WHERE ${isPlain}
    ${marker}
  `;
}

/**
 * Strict UPDATE: only SSN column + SSNEncryptedFix. Parameterized.
 * @param {string} ssnColumn
 */
export function buildStrictUpdateSql(ssnColumn) {
  const col = quoteIdent(ssnColumn);
  return `
    UPDATE dbo.CleanClaims
    SET ${col} = @encrypted,
        SSNEncryptedFix = 1
    WHERE MailingListID = @pk
      AND ISNULL(SSNEncryptedFix, 0) = 0
  `;
}

/** @param {import('mssql').ConnectionPool} pool */
export async function hasMarkerColumn(pool) {
  const r = await pool.request().query(`
    SELECT 1 AS ok WHERE COL_LENGTH('dbo.CleanClaims', 'SSNEncryptedFix') IS NOT NULL;
  `);
  return r.recordset.length > 0;
}

/** @param {import('mssql').ConnectionPool} pool @param {string} ssnColumn */
export async function countCandidates(pool, ssnColumn, hasMarker) {
  const { isPlain } = plaintextSqlExpr(quoteIdent(ssnColumn));
  const markerClause = hasMarker ? ' AND ISNULL(SSNEncryptedFix, 0) = 0' : '';
  const result = await pool.request().query(`
    SELECT COUNT(*) AS c
    FROM dbo.CleanClaims
    WHERE ${isPlain}
    ${markerClause}
  `);
  return Number(result.recordset[0]?.c) || 0;
}
