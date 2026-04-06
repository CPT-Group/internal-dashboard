/*
Purpose:
1) Find the case mapping in CPTMaster (website DB + CleanClaims DB)
2) Confirm active/inactive status
3) Reuse the mapped DB names in later scripts

How to use:
- Replace the WHERE filter as needed for your case name.
*/

SELECT TOP 20
  TRY_CONVERT(nvarchar(512), o.CaseName)       AS case_name,
  TRY_CONVERT(nvarchar(256), o.WebServerDBName) AS website_db_name,
  TRY_CONVERT(nvarchar(256), o.SQLName)         AS cleanclaims_db_name,
  ISNULL(o.Active, 0)                           AS is_active
FROM [CPTMaster].dbo.OCPAutomation o
WHERE LOWER(ISNULL(TRY_CONVERT(nvarchar(512), o.CaseName), '')) LIKE '%fashion%'
  AND LOWER(ISNULL(TRY_CONVERT(nvarchar(512), o.CaseName), '')) LIKE '%alcazar%'
ORDER BY o.CaseName ASC;

/*
Optional: discover candidate matching columns in target CleanClaims table.
Replace [YOUR_CLEANCLAIMS_DB] after mapping above.
*/
SELECT c.COLUMN_NAME
FROM [YOUR_CLEANCLAIMS_DB].INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_SCHEMA = 'dbo'
  AND c.TABLE_NAME = 'CleanClaims'
  AND (
    LOWER(c.COLUMN_NAME) LIKE '%mailinglist%'
    OR LOWER(c.COLUMN_NAME) LIKE '%submission%'
    OR LOWER(c.COLUMN_NAME) LIKE '%confirm%'
    OR LOWER(c.COLUMN_NAME) LIKE '%claimfiledonline%'
    OR LOWER(c.COLUMN_NAME) LIKE '%submittedonline%'
  )
ORDER BY c.ORDINAL_POSITION;

