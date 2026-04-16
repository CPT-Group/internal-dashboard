---
name: submission-health-check
description: Runs a single-site Website Health submission report (total, today, yesterday) and posts a focused Teams update. Use when the user asks for /submission-health-check, a one-case submission report, or submission-volume details for a specific project/site.
---

# Submission Health Check

Use this skill for one-case submission-volume analysis.

Primary trigger example:

- `/submission-health-check CompassionHealthCare_Allin_C`

## Inputs

Accept any one of:

- Project/site key (`CompassionHealthCare_Allin_C`)
- Website DB name
- Case name (`OCPAutomation.CaseName`)

If no identifier is provided, ask for one.

## Default workflow

1. Resolve the active-site mapping from `CPTMaster.dbo.OCPAutomation`:
   - `CaseName`
   - `WebServerDBName`
   - `SQLName`
   - `Active`
2. Run a submissions report for that site using Website DB `Submissions` and standard Website Health source filters:
   - `DateReceived IS NOT NULL`
   - include prior dates and only today rows with `DateReceived <= 05:15:00`
   - exclude IDs `2000000` through `2000039`
   - exclude emails containing `@cptgroup.com`
   - apply deadline cutoff when present
3. Return counts:
   - `totalSubmitted`
   - `submittedToday`
   - `submittedYesterday`
4. Status:
   - `OK` when query succeeds
   - `BAD` when DB/schema/connectivity prevents a valid count
5. Post a Teams message unless the user says not to.

## Optional supplemental context

If the user asks for "combo" context, also include compare-side metrics from `GET /api/website-health/site`:

- `submittedOnlineCount`
- `matchedInCleanClaimsCount`
- `missingCount`
- `webDbStatus`

## Controlled remediation workflow (when user asks to fix)

Use this sequence before any data change:

1. **Pre-check snapshot**
   - Capture site metrics (`submittedOnlineCount`, `matchedInCleanClaimsCount`, `missingCount`, `webDbStatus`)
   - Save the exact affected row IDs
2. **Identity check (inspection-only)**
   - For each affected Submission ID, compare source vs target:
     - `Submission.ID` -> `CleanClaims.MailingListID`
     - `ConfirmationNo` (exact + normalized)
     - `Email`/`City`/`State`/`Zip` when available
   - Classify each row:
     - `NO_TARGET_ROW`
     - `TARGET_ROW_CONFIRMATION_MISMATCH`
     - `TARGET_ROW_FILTERED_OUT` (online-flag falsey)
3. **Change plan**
   - Propose a narrow SQL action (update-only preferred)
   - Require explicit user approval before writes
4. **Apply in transaction**
   - Update only classified rows
   - Keep audit output: IDs, old values, new values, row counts
5. **Post-check snapshot**
   - Re-run site details and confirm expected metric movement
6. **Ticket hygiene**
   - Add concise Jira comment on findings + action + post-check
   - Log time spent (for example 30 minutes when requested)

Never bulk-copy rows blindly when a row already exists; classify first, then apply the minimal safe change.

## Mandatory safety checks

- Confirm required env vars exist:
  - `DB_SERVER`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`
  - `PROD_DB_SERVER`, `PROD_DB_USER`, `PROD_DB_PASSWORD`, `PROD_DB_PORT`
  - `WEBSITE_HEALTH_TEAMS_WEBHOOK_URL` (if posting)
- Never include secrets.
- If the site cannot be resolved from OCPAutomation, stop and report the unresolved identifier.

## Output format (to user)

- Case mapping:
  - case name
  - website DB
  - SQL DB
  - active flag
- Submission counts:
  - total
  - today
  - yesterday
- Scope notes (filters + 5:15 cutoff)
- Status (`OK` or `BAD`) with exact failure reason when bad

## Teams message format

Use a single-case summary with consistent field labels:

- `Site: <site>`
- `Status: OK/BAD`
- `Total Submitted: <total>`
- `Submitted Today: <today>`
- `Submitted Yesterday: <yesterday>`

Include a short scope line noting filters and 5:15 AM cutoff.

## SQL pattern (single site submission counts)

```sql
SELECT
  COUNT(1) AS total_submitted_count,
  SUM(
    CASE
      WHEN CAST(s.DateReceived AS date) = CAST(GETDATE() AS date)
        AND CAST(s.DateReceived AS time) <= CAST('05:15:00' AS time)
      THEN 1
      ELSE 0
    END
  ) AS submitted_today_count,
  SUM(
    CASE
      WHEN CAST(s.DateReceived AS date) = DATEADD(DAY, -1, CAST(GETDATE() AS date))
      THEN 1
      ELSE 0
    END
  ) AS submitted_yesterday_count
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
  AND (
    s.Email IS NULL
    OR LOWER(LTRIM(RTRIM(TRY_CONVERT(nvarchar(320), s.Email)))) NOT LIKE '%@cptgroup.com%'
  );
```
