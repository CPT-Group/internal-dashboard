# Website Health Dashboard Plan

## Goal

Build a **responsive (mobile-first)** dashboard page at `/website-health` that detects downloader sync misses between:

- Production website DBs on `10.0.0.5` (`Submissions`)
- Related 2K16 DBs (`CleanClaims`)

This page is **not TV-focused** and should remain independent from existing TV dashboard conventions.

## Business Rule to Validate

For each monitored website/database pair:

1. In website DB (`10.0.0.5`), identify records where `DateReceived IS NOT NULL` (submitted online).
2. For each submitted record, verify a corresponding row exists in `CleanClaims` in the mapped 2K16 DB.
3. Missing `CleanClaims` rows are discrepancies (downloader misses).

## Active Site Source of Truth (deep-dive findings)

On CPT2K16, the active case list is sourced from:

- Database: `CPTMaster`
- Table: `dbo.OCPAutomation` (note: **OCP**, not OCB)

Relevant columns discovered:

- `CaseName` (display label for UI)
- `WebServerDBName` (website DB name on `10.0.0.5`)
- `SQLName` (2K16 clean-claims DB name)
- `Active` (bit flag; `1` = active case)
- `LastRan` (last downloader run timestamp for this case entry)

Current observed counts:

- Total rows in `OCPAutomation`: **272**
- Active rows (`Active = 1`): **20**

Important mapping note:

- Do **not** derive 2K16 DB names purely as `WebServerDBName + '_SQL'`.
- In active rows, most follow suffix convention, but exceptions exist (observed mismatches: 2).
- Use `SQLName` as canonical 2K16 DB mapping and `WebServerDBName` as canonical website DB mapping.

## Data Model (suggested)

Use typed DTOs from a server API route:

- `WebsiteHealthRunSummary`
  - `runAt`
  - `totalSitesChecked`
  - `sitesWithIssues`
  - `totalSubmittedOnline`
  - `totalMissingInCleanClaims`
- `WebsiteHealthSiteResult`
  - `siteKey`
  - `websiteDbName`
  - `cleanClaimsDbName`
  - `submittedOnlineCount`
  - `matchedInCleanClaimsCount`
  - `missingCount`
  - `status` (`ok` | `warning` | `error`)
  - `missingItems: WebsiteHealthMissingItem[]`
- `WebsiteHealthMissingItem`
  - `submissionId`
  - `confirmationNo` (if available)
  - `dateReceived`
  - `reason` (`missing_clean_claim`)

## API Shape

Create server-only endpoints under `src/app/api/website-health/`:

- `GET /api/website-health/summary`
  - Returns latest scan summary + per-site rollups.
- `GET /api/website-health/site?siteKey=...`
  - Returns detailed discrepancy rows for one site.
- `POST /api/website-health/run`
  - Triggers an on-demand read-only scan.
  - Optionally emits Teams alert only if discrepancies are found.

Current implementation shape in repo:

- `GET /api/website-health?sinceDays=...` (summary scan; default scope is all submitted rows)
- `POST /api/website-health` (manual run; refreshes active-case mapping and can notify Teams)
- `GET /api/website-health/site?siteKey=...&sinceDays=...` (on-demand per-site missing-row details)

## SQL Execution Strategy (read-only)

- Use `mssql` server-side only.
- Use environment-driven pool configs:
  - `PROD_DB_*` for `10.0.0.5` base access
  - `DB_*` for 2K16 base access
- For each site pair:
  - Run read-only query on website DB for submitted items.
  - Run read-only query on mapped 2K16 DB for candidate `CleanClaims`.
  - Compare by stable key (`SubmissionId`/foreign key).
- Avoid cross-server joins; query each source separately and compare in Node.

## Site Mapping Config

Preferred source:

- Query `CPTMaster.dbo.OCPAutomation WHERE Active = 1` and derive mapping dynamically from:
  - `siteKey`/display from `CaseName`
  - `websiteDbName` from `WebServerDBName`
  - `cleanClaimsDbName` from `SQLName`

Optional override support:

- Keep `WEBSITE_HEALTH_SITE_MAP_JSON` for emergency/manual overrides, but dynamic DB source should be default.

## Memoization / Caching Strategy

Active-site lookup should be memoized to avoid repeated metadata queries:

- In-memory cache key: `websiteHealth.activeSites`
- TTL: **15-30 minutes** (recommended start: 20 minutes)
- Manual bypass on demand (for "Run scan now" with refresh toggle)
- Persist only non-secret metadata (case/db names, active flag)
- Env knobs:
  - `WEBSITE_HEALTH_ACTIVE_CASES_TTL_MIN` (default `20`)
  - `WEBSITE_HEALTH_ACTIVE_CASES_DATABASE` (default `CPTMaster`)

## UI/UX (mobile-first)

Recommended PrimeReact stack:

- `Card` for KPI tiles (stacked on mobile).
- `DataTable` for site rollup and discrepancy lists.
- `Tag` for clear status labels (`OK`, `Issues`, `Error`).
- `Accordion` or row expansion for per-site details.
- `Chart`/`MeterGroup` optional for quick health visuals.

Suggested layout:

1. Top summary KPIs (Submitted, Missing, Sites with Issues, Last Run).
2. Site health table sorted by `missingCount DESC`.
3. Drill-in section (expanded site details with missing rows).
4. Run controls (Refresh scan button + last successful run time).

## Alerting Strategy (Teams)

Use `.env.local` key:

- `WEBSITE_HEALTH_TEAMS_WEBHOOK_URL`

Behavior:

- Send Teams message **only** when at least one discrepancy is detected.
- Include:
  - run timestamp
  - number of impacted sites
  - total missing count
  - top affected site list
- Add de-duplication window (example: 30-60 minutes) to avoid spam.

## Safety and Performance

- Read-only SQL only (`SELECT`).
- Add bounded query windows if needed (for example, recent N days).
- Add timeout and retry policy per site.
- Return partial results with per-site error status when one DB fails.

## Phased Delivery

1. **Phase 1**
   - Site map config
   - server scan utility
   - summary API
   - basic responsive table page
2. **Phase 2**
   - drill-down discrepancy list
   - manual rerun action
   - better status visuals/charts
3. **Phase 3**
   - Teams alerts with de-duplication
   - optional scheduled scan endpoint/job trigger

