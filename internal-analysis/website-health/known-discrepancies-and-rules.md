# Known Discrepancies and Rules

Use this as a checklist before calling anything "missing."

## Current source-side rules

Treat source records as in-scope only when:

1. `DateReceived IS NOT NULL`
2. `DateReceived` is **before today** (exclude same-day submissions because downloader runs overnight)
3. Submission ID is **not** in test range `2000000` through `2000039`
4. Email does **not** contain `@cptgroup.com` (internal testing traffic excluded)
5. Optional case cutoff rules are applied when agreed by business (example: `DateReceived <= 2025-10-20`)

## Current target-side rules

- Compare to `CleanClaims` records that are online-submitted (`ClaimFiledOnline` style truthy flag when available).
- Match method must be declared in report:
  - Confirmation method,
  - ID linkage method,
  - or hybrid fallback.

## Why counts can differ (normal causes)

1. **Different key type used** (confirmation vs ID linkage).
2. **Cutoff window not applied consistently** between teams/runs.
3. **Internal test traffic included by one query and excluded by another**.
4. **Legacy/manual batch rows** where linkage fields were not populated the same as normal pipeline rows.

## What to include in every report

- Scope window used (`all` or specific days/cutoff date).
- Source exclusions used (internal emails, null date received).
- Match method used.
- Missing count by method (if more than one method was run).
- Short interpretation:
  - "true likely missing,"
  - "expected exclusion,"
  - or "linkage/method discrepancy."

## Red flags worth root-cause analysis

- High confirmation-based missing.
- Sudden increase in rows without confirmation number.
- Sudden increase in rows failing both confirmation and ID checks.
- Large shifts after deployments or manual backfills.

