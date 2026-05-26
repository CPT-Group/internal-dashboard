-- Idempotent: traceability column for NOVA-2454 SSN remediation.
-- Only the target SSN column and SSNEncryptedFix may be updated by remediation scripts.
IF COL_LENGTH('dbo.CleanClaims', 'SSNEncryptedFix') IS NULL
BEGIN
  ALTER TABLE dbo.CleanClaims
    ADD SSNEncryptedFix BIT NOT NULL
      CONSTRAINT DF_CleanClaims_SSNEncryptedFix DEFAULT (0);
END;
