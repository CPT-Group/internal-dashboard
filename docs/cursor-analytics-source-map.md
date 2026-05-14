# Cursor analytics: source map and parity

This document ties together **Cursor.com team dashboards**, **Team Admin API** (`https://api.cursor.com`, Basic auth with team key), **CSV exports** (`npm run cursor-analytics:regen`), and the internal app **`/cursor-analytics`** so we can chase **monetary parity** (per dev, per repo, per dev×repo) without guessing which numbers should match.

## Cursor.com (browser) → purpose

| Left nav (Team Settings) | What to trust it for | Notes |
|--------------------------|----------------------|--------|
| **Analytics** | Activity volume, **repo filter** (`repoName=owner%2Frepo`), time series by model, **AI edits by repository**, **Show API cURL** | Ground truth that **repos exist** and how Cursor aggregates them; use cURL to discover official query shapes. |
| **Members** | Seat count, roles, **included usage** hints per member | Cross-check emails against `/teams/spend` `teamMemberSpend`. |
| **Usage** | **On-demand $** vs cap, line-item table (user / type / model), **Export CSV** | Often shown with **1d / 7d / 30d** chips — **UI window can differ from URL `startDate`/`endDate`**; align presets when comparing to our **Charged (range)**. |
| **Spending** | Team on-demand cap, alerts | Policy; explains caps, not the same field as `spendCents`. |
| **Billing & Invoices** | **Current cycle** included vs on-demand, model mix, Stripe | Aligns with **Cycle billed** vs **Cycle overall (API)** language on our KPI hint. |

## Team Admin API → internal code

| Endpoint | Used in | Feeds our UI |
|----------|---------|----------------|
| `POST /teams/spend` | `src/lib/cursorAdminApi.ts` `fetchSpend` | KPI **Cycle billed** (`spendCents` sum), Developers **Cycle billed / Cycle overall**, hint row. |
| `POST /teams/daily-usage-data` | `fetchDailyRangeAggregated` | **Usage / included reqs** by day and by **developer** (range-scoped in API client). |
| `POST /teams/filtered-usage-events` | `fetchChargedByDay` | **Charged cents** → by day, month, developer, **repo**, **repo×developer**, **month×developer**; repo string via `src/utils/cursorUsageEventRepo.ts`. |

**Usage events ingestion (accurate daily $):** the handler walks **each UTC calendar day** in the selected range, calls `/teams/filtered-usage-events` for that day’s `[startMs,endMs]`, and **paginates until `hasNextPage` is false** (per-day safety cap: `CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES_PER_DAY`, default **50_000** pages × 100 rows). Between HTTP calls it waits `CURSOR_ANALYTICS_USAGE_EVENTS_REQUEST_DELAY_MS` (default **3100** ms) to stay under Cursor’s **20 requests/minute per team** limit. Disk cache key includes this policy (`usageEventsPolicy` v2 in `cursor-admin-billing-cache.json`). If `usageEventRowsReturned` &lt; summed `totalUsageEventsCount` from the API, the UI marks the load **incomplete** and **disables CSV dollar backfill** on the Trend chart so values are not misleading.

**Billing range cap:** `CURSOR_ANALYTICS_USAGE_EVENTS_MAX_RANGE_DAYS` (default **120**) trims the range to the **most recent** N UTC days before calling the Admin API (response `warnings` explain the clip). Raise on self-hosted / long `maxDuration` hosts if needed.

**Skip events:** set `CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES=0` (legacy env name) to omit all usage-event calls.

**Reconciliation script:** `npm run cursor-analytics:reconcile-day -- 2026-05-13` — full pagination for one UTC day, prints team cents and per-email sums for comparison with Cursor.com Usage.

## CSV summary (`kyleOutput/cursor-analytics-summary.json`)

| Source file (typical) | `summarize-cursor-exports.mjs` | Use in app |
|----------------------|--------------------------------|-------------|
| `Analytics_Team_*.csv` | `byDay.amount` = usage-based request **counts** (not USD) | **Trend backfill** scaling in `teamDailyUsdTrendHybrid`; long history when events miss days. |
| Dedicated **AI edits by repository** export | `repoAiEdits` | **Repos** tab **fallback**: allocate **range charged total** by **AI line share** (labeled **AI lines × charged (est.)**). |
| Dedicated **repo × developer** export | `repoDeveloperAiEdits` | **Repo × developer** fallback; same labeling. |

## Internal UI tabs → data

| Tab | Primary $ source | Fallback / blend |
|-----|------------------|------------------|
| **Trend (daily)** | `chargedCents` by day (full per-day pagination) | CSV `byDay` scaled only when event load is **complete**; disabled when incomplete |
| **Money (range)** | Join `/teams/spend` + events + daily usage **scoped to selected ISO range** | One row per member + rows for event-only emails |
| **Developers** | Raw tables: cycle spend, usage+charged, charged-only | Reference / export |
| **Repos** | `byRepo` from events | `repoAiEdits` pro-rata of **range** charged total; **Basis** column |
| **Repo × developer** | `byRepoDeveloper` from events | `repoDeveloperAiEdits` pro-rata; **Basis** column |
| **Month × developer / By month** | From events | No CSV fallback yet |

## “100% parity” reality

- **Cursor.com** and **Admin API** do not guarantee identical totals for the same dates (different aggregation windows, caps, included vs on-demand, truncation).
- **True lifetime per-dev $** is not exposed as a single Admin field; we document **cycle** vs **range charged** explicitly.
- **Next improvements** (when needed): optional **month×repo** from events if we extend `fetchChargedByDay` to track keys `YYYY-MM\trepo`; ingest **Usage CSV** from Cursor.com export into `summarize` for reconciliation; raise `CURSOR_ANALYTICS_USAGE_EVENTS_MAX_RANGE_DAYS` or host `maxDuration` for longer windows without clipping.
