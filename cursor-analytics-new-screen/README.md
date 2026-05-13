# Cursor usage / cost exports (local analytics)

This folder is for **CSV files you download from the Cursor web dashboard** (Analytics → per-chart CSV or header “download all”). The repo **ignores `*.csv` here by default** so emails and usage details are not committed by accident.

**Finding files here:** Because `*.csv` is gitignored, many search tools (and some agent workspace indexes) **will not list those files**. Use an explicit path, your OS file explorer, or a terminal from repo root, e.g. `Get-ChildItem -Force cursor-analytics-new-screen` (PowerShell). See **AGENTS.md → “Gitignored local paths”** for the broader pattern (other root scratch folders behave the same way).

## Summaries and dashboard

- **`npm run cursor-analytics:summarize`** — prints aggregated JSON to stdout.
- **`npm run cursor-analytics:regen`** — writes **`kyleOutput/cursor-analytics-summary.json`** (gitignored). The app route **`/cursor-analytics`** loads that file through **`GET /api/cursor-analytics`** (client refresh every 5 minutes). **No calls to Cursor’s cloud analytics API** — only local disk reads after you refresh the JSON from CSVs.

Optional env **`CURSOR_ANALYTICS_SUMMARY_JSON`**: absolute path, or path relative to repo root, to read a different summary file.

## What Cursor exposes (important)

| Path | Who | Notes |
|------|-----|--------|
| **Dashboard CSV export** | Team / Enterprise (per [Usage Analytics](https://cursor.com/docs/account/teams/analytics)) | Best fit for **per month, per repo, per developer** once columns match your exports. |
| **Analytics API** (`api.cursor.com` … `/analytics/team/...`) | **Enterprise only** | Not available on individual/free-tier-style plans; needs admin-scoped API key. |
| **Admin API** (members, audit logs, spend) | **Team admin** | Same auth model; not a substitute for full “billing breakdown” unless your plan includes those endpoints. |
| **Cursor SDK / “CLI agent”** | Developers | Runs agents (`@cursor/sdk`); **does not** return invoice or dashboard analytics. |

There is **no supported way for this repo to “log into” your Cursor account** from here. Use CSV export + local scripts, or upgrade to Enterprise and use the official API with a server-side key (never `NEXT_PUBLIC_*`).

## Conservative workflow (no extra Cursor spend)

1. Export CSVs from the dashboard **only when you need a refresh** (e.g. monthly).  
2. Drop files into this folder.  
3. Run the summarizer (writes nothing to Cursor):

   ```bash
   npm run cursor-analytics:summarize
   ```

   Or:

   ```bash
   node scripts/cursor-analytics/summarize-cursor-exports.mjs --dir cursor-analytics-new-screen
   ```

4. Optional: save output with `--out cursor-analytics-new-screen/latest-summary.json` and open in a spreadsheet or wire a **static** internal-dashboard page that reads that JSON at build time (no polling of Cursor).

## “Live” dashboard

A page that **polls Cursor’s API** would require Enterprise keys and would count as normal API usage—not the same as “Cursor model usage inside the editor,” but still something to rate-limit.

A page that shows **last generated JSON** (checked in or produced in CI monthly) adds **zero** ongoing Cursor analytics cost.

## Column detection

The script guesses columns by header name (case-insensitive): dates, user/email, repository, and currency/token numeric fields. If headers differ, run with `--verbose` and adjust the CSV or extend the synonym lists in `scripts/cursor-analytics/summarize-cursor-exports.mjs`.
