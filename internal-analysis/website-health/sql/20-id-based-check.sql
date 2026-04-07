/*
ID-linkage comparison (technical/pipeline method).

What this answers:
"How many in-scope source submissions do NOT have a matching target
 MailingListID (or equivalent ID column)?"

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
TargetIds AS (
  SELECT DISTINCT
    TRY_CONVERT(int, cc.[YOUR_ID_COLUMN]) AS linked_id
  FROM [YOUR_CLEANCLAIMS_DB].dbo.CleanClaims cc
  WHERE (cc.ClaimFiledOnline = 1 OR cc.ClaimFiledOnline = 'true' OR cc.ClaimFiledOnline = 'True')
    AND TRY_CONVERT(int, cc.[YOUR_ID_COLUMN]) IS NOT NULL
)
SELECT
  (SELECT COUNT(*) FROM SourceRows) AS source_rows_in_scope,
  (SELECT COUNT(*) FROM TargetIds) AS distinct_target_linked_ids,
  (
    SELECT COUNT(*)
    FROM SourceRows s
    WHERE NOT EXISTS (
      SELECT 1
      FROM TargetIds t
      WHERE t.linked_id = s.submission_id
    )
  ) AS missing_by_id_linkage;

/*
Optional detail list (top 200 missing by ID linkage):
*/
SELECT TOP 200
  s.submission_id,
  s.DateReceived
FROM SourceRows s
WHERE NOT EXISTS (
  SELECT 1
  FROM TargetIds t
  WHERE t.linked_id = s.submission_id
)
ORDER BY s.DateReceived DESC;

