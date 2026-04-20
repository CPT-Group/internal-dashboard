---
name: website-health-report-by-date
description: Runs the Website Health Submission and/or Deficiency scan (the dashboard button is "Scan by Date") scoped to a single date or a date range using the 5:15 AM downloader window, then surfaces the results and posts to the Teams webhook. Use when the user invokes `/website-health-report-by-date`, `/scan-by-date`, asks for a submission or deficiency scan for a specific day or range, or wants per-day submission/deficiency totals across active sites.
---

# Website Health Scan by Date

Use this skill when the user asks for a date-scoped Submission and/or Deficiency Website Health scan (invoked as `/website-health-report-by-date`, `/scan-by-date`, or similar — the Website Health dashboard button is labeled **Scan by Date**). The downloader runs at **05:15 AM local SQL-server time**, so a "day" D covers `[D 05:15:00, D+1 05:15:00)` rather than `[00:00, 24:00)`.

## Inputs

Accept any of these shapes:

- A single day: `4-18-2026`, `4/18/2026`, `04-18-2026`, `2026-04-18`.
- A range: `4-18-2026 to 4-20-2026`, `2026-04-18..2026-04-20`, `April 18–20, 2026`.
- Optional report filter: "submission only", "deficiency only" (a.k.a. "daily only"), "both" (default: both).
- Optional Teams toggle: "no teams" / "skip teams" → `notify: false` (default: true).

Normalize every date to `YYYY-MM-DD`. If the user provides only a single day, send it as both `startDate` and `endDate`.

If the user gives something ambiguous (for example `4-18`), ask which year they mean before firing the run.

## Workflow

1. Parse the dates and options.
2. Confirm intent when the scope is large (range > 7 days) or when Teams is on and the user did not explicitly ask for a Teams post.
3. Call the API:

```
POST http://localhost:3000/api/website-health/report-by-date
Content-Type: application/json

{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "reportTypes": ["submission", "daily"],
  "notify": true
}
```

- `reportTypes` must be a non-empty subset of `["submission", "daily"]` — the API keeps the historical `daily` key even though the UI and Teams message now label this section **Deficiency Scan**.
- Omit or set `notify: false` to skip the Teams post.
- The server builds the 5:15-anchored window from the two dates — do **not** pre-shift the timestamps.

4. Read the JSON response (`WebsiteHealthReportByDateResponse`). Relevant fields:
   - `window.startDate`, `window.endDate`, `window.startDateTime`, `window.endDateTimeExclusive`.
   - `submission` (nullable): per-site `windowSubmittedCount` plus totals.
   - `daily` (nullable) — surfaced as **Deficiency Scan** in user output: per-site `windowDeficientTrueCount` / `windowDisputedTrueCount` plus `dateColumnUsed` and totals.
   - `alerted`, `alertMessage`.

5. If the response has `"ok": false`, surface `message` to the user and stop.

## Output format

Return a concise text summary using this template. Do not paste entire site arrays — show totals + a short list of notable rows only.

```
## Website Health Scan by Date — <M/D/YYYY>[ → <M/D/YYYY>] — <Submission | Deficiency | Submission + Deficiency> — ran <M/D/YYYY at h:mmam|pm>

- Scope: <startDate>[ → <endDate>]
- Window (5:15 anchor): <startDateTime> → <endDateTimeExclusive> (exclusive)
- Teams: <SENT | NOT SENT> (<alertMessage if any>)

### Submission Scan · <scope> (only if returned)
- Active sites checked: <n>
- Total submitted in window: <n>
- Top sites: <site — count>, ...
- Errors (if any): <site — errorMessage>

### Deficiency Scan · <scope> (only if returned)
- Active sites checked: <n>
- Deficient TRUE in window: <n>
- Disputed TRUE in window: <n>
- Date column(s) used: <distinct list from dateColumnUsed>
- Top sites by Deficient: <site — deficient/disputed>, ...
- Errors (if any): <site — errorMessage>
```

## Notable fields and gotchas

- **5:15 cutoff**: the SQL predicate is `DateReceived >= startDateTime AND DateReceived < endDateTimeExclusive` — half-open on the right. A row with `DateReceived = 2026-04-19 05:15:00.000` belongs to 2026-04-19, not 2026-04-18.
- **Daily report requires a date column on `CleanClaims`**. The service probes `DateReceived`, `DateAdded`, `DateEntered`, `EnteredDate`, `CreatedDate`, `CreatedOn`, `DateCreated`, `RecordDate` in that order. If none match, the site comes back `status: "error"` with an explanatory `errorMessage` and zero counts — surface that to the user verbatim so they know the site needs a schema probe.
- **Submission report** reuses the same filters as the existing report (`DateReceived IS NOT NULL`, exclude test IDs `2000000–2000039`, exclude `@cptgroup.com` emails, honor the site's deadline date).
- **Do not modify** the existing `/api/website-health/daily-report` or `/api/website-health/submission-report` routes — those are the all-time rollups that the dashboard's **Deficiency Scan** (legacy label "Daily Report") and **Submission Scan** (legacy label "Submission Report") buttons drive.

## When to also persist the result

If the user asks for an artifact, save the raw JSON response under `kyleOutput/website-health-by-date/by-date-<startDate>[__<endDate>]-<timestamp>.json` so the exact payload is reproducible. Never commit this folder.

## Required environment

- `DB_SERVER` / `DB_USER` / `DB_PASSWORD` / `DB_PORT` (2K16 CleanClaims).
- `PROD_DB_SERVER` / `PROD_DB_USER` / `PROD_DB_PASSWORD` / `PROD_DB_PORT` (10.0.0.5 website Submissions).
- `WEBSITE_HEALTH_TEAMS_WEBHOOK_URL` (only when `notify: true`).
