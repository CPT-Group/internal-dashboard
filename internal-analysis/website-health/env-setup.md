# Environment Setup for Carlos (No Secrets in Repo)

Carlos will need a local `.env.local` file in the repo root to run SQL-based analysis through scripts or API endpoints.

Do **not** commit `.env.local`.

## Required variable names

Use these exact names:

```env
# Jira (only needed if reading Jira issue details through local scripts)
JIRA_BASE_URL="https://your-company.atlassian.net"
KYLE_EMAIL="first.last@company.com"
KYLE_JIRA_TOKEN="paste-token-here"

# CPT2K16 / claims-side SQL server (where CPTMaster + *_SQL databases live)
DB_SERVER="CPT2K16"
DB_DATABASE="CPTMaster"
DB_USER="your-sql-user"
DB_PASSWORD="get-from-secure-source"
DB_PORT="1433"

# Production website SQL server (where website Submissions DBs live)
PROD_DB_SERVER="10.0.0.5"
PROD_DB_DATABASE="CPTMaster"
PROD_DB_USER="your-prod-sql-user"
PROD_DB_PASSWORD="get-from-secure-source"
PROD_DB_PORT="1433"

# Optional (only needed if posting Website Health notes to Teams)
WEBSITE_HEALTH_TEAMS_WEBHOOK_URL="https://...incoming-webhook-url..."
```

## What each server is used for

- `DB_SERVER` (`CPT2K16`): `CPTMaster` mapping lookup and `CleanClaims` target checks.
- `PROD_DB_SERVER` (`10.0.0.5`): website `Submissions` source checks.

## Minimum access required

Carlos needs read access to:

- `CPTMaster.dbo.OCPAutomation` on `DB_SERVER`
- `<CaseSQLName>.dbo.CleanClaims` on `DB_SERVER`
- `<CaseWebsiteDB>.dbo.Submissions` on `PROD_DB_SERVER`

## Quick verification checklist

1. `.env.local` exists in repo root.
2. No placeholder strings left in required fields.
3. Can connect to both SQL servers.
4. Can run `carlos testing/sql/00-setup-and-mapping.sql` successfully.

