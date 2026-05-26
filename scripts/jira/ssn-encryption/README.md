# CleanClaims SSN audit & remediation (NOVA-2451 / NOVA-2454)

Tracked scripts for CPT2K16 `dbo.CleanClaims` SSN audit and encryption remediation.

Local working copies may also exist under `cursorScripts/jira/` (gitignored). **Run from repo root:**

```bash
node scripts/jira/ssn-encryption/discover-ssn-encryption.mjs
node scripts/jira/ssn-encryption/apply-ssn-encrypted-fix-column.mjs          # dry-run
node scripts/jira/ssn-encryption/apply-ssn-encrypted-fix-column.mjs --execute
node scripts/jira/ssn-encryption/remediate-cleanclaims-ssn.mjs --database HomeDepot_Bell_O_SQL
```

## Update rule

Remediation `UPDATE` touches **only**:

- The target SSN column (`SSN`, `ssnString`, etc.)
- `SSNEncryptedFix = 1`

No other `CleanClaims` columns are modified.

## Before `--execute`

1. Complete CPTSQL20 encrypt spike (see `docs/cleanclaims-ssn-encryption.md`).
2. Set `SSN_ENCRYPT_SQL` in `.env.local` (returns column `encrypted` for `@plain`).
3. Apply `SSNEncryptedFix` DDL on flagged DBs.

Audit results JSON: `cursorScripts/jira/ssn-audit-results.json` (or `SSN_AUDIT_RESULTS_PATH`).
