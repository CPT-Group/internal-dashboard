# CleanClaims SSN encryption (CPTSQL20 pipeline)

**Jira:** NOVA-2451 (audit) · NOVA-2454 (remediation)

## Critical rule

Remediation **only** updates:

1. The specific SSN column being fixed (e.g. `SSN`, `ssnString`)
2. `SSNEncryptedFix` (BIT traceability)

**No other `CleanClaims` columns are modified.**

## Production encrypted shape

- **Length:** 35 characters (hex-style), per `vwShowSSNsInClaimsNotEncrypted` (`len(ssn) between 1 and 34` = treat as not encrypted).
- **Do not use** `CPTMaster.dbo.EncryptSSN` for remediation — legacy letter-substitution UDF; does not produce the 35-char value.

## Servers

| Server | Auth | Role |
|--------|------|------|
| CPT2K16 | `DB_*` in `.env.local` | Case DBs, remediation `UPDATE` |
| CPTSQL20 | Windows integrated (workstation) | Encrypt service; linked server `CPTSQL20` from CPT2K16 |

## Configure encrypt (required for `--execute`)

Set on workstation (not committed):

```bash
# SQL run on CPT2K16; must accept @plain and return column `encrypted`
SSN_ENCRYPT_SQL="SELECT ... AS encrypted"
```

Complete CPTSQL20 spike on a domain-joined machine, then paste the working call here.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/jira/ssn-encryption/discover-ssn-encryption.mjs` | Refresh discovery JSON + this doc |
| `scripts/jira/ssn-encryption/apply-ssn-encrypted-fix-column.mjs` | Add `SSNEncryptedFix` (155 flagged DBs) |
| `scripts/jira/ssn-encryption/remediate-cleanclaims-ssn.mjs` | Dry-run / execute (SSN column + flag only) |

## Discovery snapshot

- **Generated:** 2026-05-26T20:01:11.486Z
- **CPTSQL20 direct (Windows auth):** failed — use linked server or VPN workstation
- **CPT2K16 linked server CPTSQL20:** see `ssn-encryption-discovery.json`
- **CPTMaster legacy EncryptSSN test len:** 0
- **Sample production encrypted len:** 35

## Default column scope

First pass: `SSN`, `ssnString`, `SSNString` only. Use `--include-all-ssn-columns` for `W9SSN` etc. after sign-off.
