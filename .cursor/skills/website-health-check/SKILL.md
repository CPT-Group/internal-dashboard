---
name: website-health-check
description: Runs a case-level Website Health discrepancy analysis and posts a manual Teams update. Use when the user asks to investigate a specific case/database, compare missing rows, or trigger a detailed Website Health Teams message.
---

# Website Health Check

Use this skill for focused, one-case Website Health work with optional Teams posting.

## Inputs

Accept any of these identifiers:

- Website DB name (example: `ColumbiaUniversity_EEOC_C`)
- CleanClaims SQL DB name (example: `ColumbiaUniversity_EEOC_C_SQL`)
- Case name (example: `EEOC v. Trustees of Columbia University in the City of New York`)

If the user did not provide a case identifier, ask for one.

## Default behavior

1. Resolve mapping from `CPTMaster.dbo.OCPAutomation`:
   - `CaseName`
   - `WebServerDBName`
   - `SQLName`
   - `Active`
2. Run a confirmation-based comparison (business-facing):
   - Source: website `Submissions`
   - Target: SQL `CleanClaims`
   - Matching key: normalized `ConfirmationNo`
3. Apply source filters:
   - `DateReceived IS NOT NULL`
   - Include prior dates and only today's rows with `DateReceived <= 05:15:00`
   - Exclude test submission IDs `2000000` through `2000039`
   - Exclude test emails containing `@cptgroup.com`
4. Include target online filter when present:
   - `ClaimFiledOnline` / equivalent truthy logic
5. Return a concise summary and then post a detailed Teams message.
6. **Web DB integrity** (if the user asks about website-table data quality, matching the dashboard): treat a row as failing if **any** of — (a) `DateReceived` is present and confirmation is blank, (b) `DateReceived` is present and submitted flag is not effectively `1`/true (**only when** a submitted-flag column exists on `Submissions`, e.g. `IsSubmitted`, `IsSubmittedOnline`), or (c) confirmation exists while `DateReceived` is null. Rows with both `DateReceived` and confirmation null are expected drafts and not errors. One row can fail multiple pillars; breakdown counts can overlap.

## Mandatory safety checks

- Confirm required env vars exist before running:
  - `DB_SERVER`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`
  - `PROD_DB_SERVER`, `PROD_DB_USER`, `PROD_DB_PASSWORD`, `PROD_DB_PORT`
  - `WEBSITE_HEALTH_TEAMS_WEBHOOK_URL`
- If DB/table/column is missing, mark status as `BAD` and explain exactly why.
- Never include secrets in output.

## Output format (analysis summary to user)

- Case metadata: case name, website DB, SQL DB, active/inactive.
- Counts:
  - submitted in scope
  - matched
  - missing
- Status:
  - `OK` when missing = 0
  - `WARNING` when missing > 0
  - `BAD` when schema/connectivity prevents a valid compare
- Root-cause notes (if known): cutoff effects, key mismatch effects, offline DB, missing table, etc.

## Teams posting behavior

Post after analysis unless the user says not to.

Teams message should include:

1. Case + DB mapping
2. Scope and filters used
3. Match method used (`ConfirmationNo`)
4. Counts and status
5. Clear reason/explanation (especially for `BAD` or high `WARNING`)

If useful, include a short SQL section showing the exact query shape used.

## SQL pattern (confirmation-based)

Use this structure (adapt identifiers to resolved mapping):

```sql
-- Source rows in scope
SELECT s.ID, s.ConfirmationNo, s.DateReceived, s.Email
FROM [<WebsiteDB>].dbo.Submissions s
WHERE s.DateReceived IS NOT NULL
  AND (
    CAST(s.DateReceived AS date) < CAST(GETDATE() AS date)
    OR (
      CAST(s.DateReceived AS date) = CAST(GETDATE() AS date)
      AND CAST(s.DateReceived AS time) <= CAST('05:15:00' AS time)
    )
  )
  AND (s.ID < 2000000 OR s.ID > 2000039)
  AND NULLIF(LTRIM(RTRIM(TRY_CONVERT(nvarchar(256), s.ConfirmationNo))), '') IS NOT NULL
  AND (
    s.Email IS NULL
    OR LOWER(LTRIM(RTRIM(TRY_CONVERT(nvarchar(320), s.Email)))) NOT LIKE '%@cptgroup.com%'
  );

-- Target confirmation set (online rows)
SELECT DISTINCT
  LTRIM(RTRIM(LOWER(TRY_CONVERT(nvarchar(256), cc.ConfirmationNo)))) AS confirmation_no
FROM [<CleanClaimsDB>].dbo.CleanClaims cc
WHERE (cc.ClaimFiledOnline = 1 OR cc.ClaimFiledOnline = 'true' OR cc.ClaimFiledOnline = 'True')
  AND NULLIF(LTRIM(RTRIM(TRY_CONVERT(nvarchar(256), cc.ConfirmationNo))), '') IS NOT NULL;
```

## Additional templates

- For message wording examples, see `teams-message-templates.md`.
