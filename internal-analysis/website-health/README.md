# Carlos Testing - Website Health Analysis Pack

This folder is a practical, copy/paste-friendly guide for validating Website Health data comparisons without reading application code.

## Goal

Help you answer:

1. What is truly missing in `CleanClaims`?
2. Which differences are expected (cutoff windows, internal test traffic)?
3. Which differences are likely data quality issues that need root-cause work?

## What is included

- `env-setup.md` - required `.env.local` variable names, server targets, and access checklist (no secrets).
- `comparison-methods.md` - plain-language explanation of each comparison method and when to use it.
- `known-discrepancies-and-rules.md` - current business rules, known edge cases, and interpretation guidance.
- `sql/00-setup-and-mapping.sql` - find the case mapping and verify database names.
- `sql/10-confirmation-based-check.sql` - confirmation-number method (business-facing truth check).
- `sql/20-id-based-check.sql` - `MailingListID`/ID linkage check (pipeline/technical check).
- `sql/30-reconciliation-breakdown.sql` - side-by-side breakdown to explain why counts differ.

## Quick start (recommended order)

1. Complete `.env.local` using `env-setup.md`.
2. Run `sql/00-setup-and-mapping.sql`.
3. Run `sql/10-confirmation-based-check.sql`.
4. Run `sql/20-id-based-check.sql`.
5. Run `sql/30-reconciliation-breakdown.sql`.
6. Use `known-discrepancies-and-rules.md` to classify results as:
   - expected,
   - data quality concern,
   - process/pipeline mapping concern.

## Important assumptions used in these scripts

- Source scope only includes submissions where `DateReceived IS NOT NULL`.
- Source includes all prior dates and only today's submissions received up to `05:15:00`; rows submitted later today are excluded until the next run window.
- Submission IDs in test range `2000000` through `2000039` are excluded.
- Internal test submissions are excluded when source email contains `@cptgroup.com`.
- CleanClaims side uses online flags when present (`ClaimFiledOnline` / equivalent).
- If a case has a business cutoff date, apply cutoff on `Submissions.DateReceived`.

