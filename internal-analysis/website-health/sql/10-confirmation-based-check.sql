/*
Confirmation-based comparison (business-facing method).

What this answers:
"How many in-scope source submissions do NOT have a matching confirmation
 number in CleanClaims online rows?"

Replace:
- [YOUR_WEBSITE_DB]
- [YOUR_CLEANCLAIMS_DB]
- optional cutoff date in @cutoff_date
- optional case-specific online flag column if different
*/

DECLARE @cutoff_date date = NULL; -- Example: '2025-10-20'. Keep NULL for no cutoff.
DECLARE @today_cutoff_time time = '05:15:00'; -- Downloader window cutoff for same-day submissions.

WITH SourceRows AS (
  SELECT
    s.ID AS submission_id,
    LTRIM(RTRIM(TRY_CONVERT(nvarchar(256), s.ConfirmationNo))) AS confirmation_no,
    s.DateReceived,
    LTRIM(RTRIM(LOWER(TRY_CONVERT(nvarchar(320), s.Email)))) AS email_normalized
  FROM [YOUR_WEBSITE_DB].dbo.Submissions s
  WHERE s.DateReceived IS NOT NULL
    AND (
      CAST(s.DateReceived AS date) < CAST(GETDATE() AS date)
      OR (
        CAST(s.DateReceived AS date) = CAST(GETDATE() AS date)
        AND CAST(s.DateReceived AS time) <= @today_cutoff_time
      )
    )
    AND (s.ID < 2000000 OR s.ID > 2000039)
    AND (@cutoff_date IS NULL OR CAST(s.DateReceived AS date) <= @cutoff_date)
    AND (
      s.Email IS NULL
      OR LTRIM(RTRIM(LOWER(TRY_CONVERT(nvarchar(320), s.Email)))) NOT LIKE '%@cptgroup.com%'
    )
),
SourceEligible AS (
  SELECT *
  FROM SourceRows
  WHERE NULLIF(confirmation_no, '') IS NOT NULL
),
TargetConfirmations AS (
  SELECT DISTINCT
    LTRIM(RTRIM(LOWER(TRY_CONVERT(nvarchar(256), cc.ConfirmationNo)))) AS confirmation_no
  FROM [YOUR_CLEANCLAIMS_DB].dbo.CleanClaims cc
  WHERE (cc.ClaimFiledOnline = 1 OR cc.ClaimFiledOnline = 'true' OR cc.ClaimFiledOnline = 'True')
    AND NULLIF(LTRIM(RTRIM(TRY_CONVERT(nvarchar(256), cc.ConfirmationNo))), '') IS NOT NULL
)
SELECT
  (SELECT COUNT(*) FROM SourceRows) AS source_rows_in_scope,
  (SELECT COUNT(*) FROM SourceEligible) AS source_rows_with_confirmation,
  (SELECT COUNT(*) FROM TargetConfirmations) AS distinct_target_confirmations,
  (
    SELECT COUNT(*)
    FROM SourceEligible s
    WHERE NOT EXISTS (
      SELECT 1
      FROM TargetConfirmations t
      WHERE t.confirmation_no = LOWER(s.confirmation_no)
    )
  ) AS missing_by_confirmation;

/*
Optional detail list (top 200 missing by confirmation):
*/
SELECT TOP 200
  s.submission_id,
  s.DateReceived,
  s.confirmation_no
FROM SourceEligible s
WHERE NOT EXISTS (
  SELECT 1
  FROM TargetConfirmations t
  WHERE t.confirmation_no = LOWER(s.confirmation_no)
)
ORDER BY s.DateReceived DESC;

