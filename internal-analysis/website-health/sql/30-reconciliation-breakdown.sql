/*
Side-by-side reconciliation report.

Purpose:
- Show confirmation-based and ID-based results in one run.
- Make discrepancy reason explicit.

Replace:
- [YOUR_WEBSITE_DB]
- [YOUR_CLEANCLAIMS_DB]
- [YOUR_ID_COLUMN] usually MailingListID
*/

DECLARE @cutoff_date date = NULL; -- Example: '2025-10-20'. Keep NULL for no cutoff.
DECLARE @today_cutoff_time time = '05:15:00'; -- Downloader window cutoff for same-day submissions.

WITH SourceRows AS (
  SELECT
    s.ID AS submission_id,
    LTRIM(RTRIM(LOWER(TRY_CONVERT(nvarchar(256), s.ConfirmationNo)))) AS confirmation_no,
    s.DateReceived
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
TargetRows AS (
  SELECT
    TRY_CONVERT(int, cc.[YOUR_ID_COLUMN]) AS linked_id,
    LTRIM(RTRIM(LOWER(TRY_CONVERT(nvarchar(256), cc.ConfirmationNo)))) AS confirmation_no
  FROM [YOUR_CLEANCLAIMS_DB].dbo.CleanClaims cc
  WHERE (cc.ClaimFiledOnline = 1 OR cc.ClaimFiledOnline = 'true' OR cc.ClaimFiledOnline = 'True')
),
TargetDistinctIds AS (
  SELECT DISTINCT linked_id
  FROM TargetRows
  WHERE linked_id IS NOT NULL
),
TargetDistinctConfirmations AS (
  SELECT DISTINCT confirmation_no
  FROM TargetRows
  WHERE NULLIF(confirmation_no, '') IS NOT NULL
),
SourceWithConfirmation AS (
  SELECT *
  FROM SourceRows
  WHERE NULLIF(confirmation_no, '') IS NOT NULL
),
PerSource AS (
  SELECT
    s.submission_id,
    s.confirmation_no,
    CASE WHEN EXISTS (
      SELECT 1
      FROM TargetDistinctIds t
      WHERE t.linked_id = s.submission_id
    ) THEN 1 ELSE 0 END AS has_id_match,
    CASE WHEN NULLIF(s.confirmation_no, '') IS NOT NULL AND EXISTS (
      SELECT 1
      FROM TargetDistinctConfirmations t
      WHERE t.confirmation_no = s.confirmation_no
    ) THEN 1 ELSE 0 END AS has_confirmation_match
  FROM SourceRows s
)
SELECT
  (SELECT COUNT(*) FROM SourceRows) AS source_rows_in_scope,
  (SELECT COUNT(*) FROM SourceWithConfirmation) AS source_rows_with_confirmation,
  (SELECT COUNT(*) FROM PerSource WHERE has_id_match = 0) AS missing_by_id,
  (SELECT COUNT(*) FROM PerSource WHERE NULLIF(confirmation_no, '') IS NOT NULL AND has_confirmation_match = 0) AS missing_by_confirmation,
  (SELECT COUNT(*) FROM PerSource WHERE has_id_match = 0 AND has_confirmation_match = 1) AS id_missing_but_confirmation_present,
  (SELECT COUNT(*) FROM PerSource WHERE has_id_match = 1 AND has_confirmation_match = 0) AS id_present_but_confirmation_missing,
  (SELECT COUNT(*) FROM PerSource WHERE has_id_match = 0 AND has_confirmation_match = 0) AS missing_by_both;

