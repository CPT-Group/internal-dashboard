# Cursor analytics (tracked)

This tree is **not gitignored** so CSV exports and the generated summary can ship with the repo (e.g. **Netlify**).

## Layout

| Path | Role |
|------|------|
| **`csv/`** | Drop **any** `*.csv` from Cursor’s team Analytics exports here. All CSVs in this folder are merged by the summarizer. |
| **`cursor-analytics-summary.json`** | Generated JSON consumed by **`GET /api/cursor-analytics`** (default). Rebuilt on **`npm run dev`** / **`npm run build`** via `predev` / `prebuild`, and when you run **`npm run cursor-analytics:regen`**. |

**Two common export shapes**

1. **Team daily rollup** (wide columns, `Models Time Series Data`, no per-user email): the summary only has aggregate team usage — the **Developers** tab still shows **estimated** dollars using an **equal split across NOVA roster names** (clearly labeled), not true per-person Cursor usage.
2. **Tabular** exports with a **user / email** column plus an amount: the Developers tab allocates the same team **model-estimate** total **in proportion to each person’s tabular amount** (best-effort; amounts may span the whole export, not only the page date picker).

## Workflow

1. Export CSVs from the Cursor web dashboard (Analytics).
2. Add or replace files under **`csv/`** (commit when you want production to pick them up).
3. Run **`npm run cursor-analytics:regen`** (or just **`npm run dev`** / **`npm run build`**) to refresh **`cursor-analytics-summary.json`**.
4. For **API monetary mode** (charged cents, repo inference), sync billing offline:
   ```bash
   npm run cursor-analytics:sync-billing -- --days 14
   ```
   Shards land under **`kyleOutput/cursor-billing-store/`** (override with **`CURSOR_ANALYTICS_BILLING_STORE_DIR`**). The dashboard **Quick refresh** hits live `/teams/spend` + `/teams/daily-usage-data` only; **Refresh** in API mode merges store shards (no live usage-event pagination on HTTP).
5. Spot-check one UTC day: **`npm run cursor-analytics:reconcile-day -- YYYY-MM-DD`** compares live pull vs store shard.

## Admin API / billing store

| Command | Role |
|---------|------|
| **`npm run cursor-analytics:sync-billing`** | CLI sync: spend, daily usage, per-day usage-event shards (`meta.json` + `days/YYYY-MM-DD.json`) |
| **`npm run cursor-analytics:reconcile-day -- YYYY-MM-DD`** | Compare store shard vs live `/teams/filtered-usage-events` for one day |
| **`npm run test:cursor-billing-store`** | Fixture tests for store merge logic |

HTTP rate limiting, 429 backoff, and ETag disk cache live in **`src/lib/cursorAdminHttp.ts`** (~18 req/min; env **`CURSOR_ANALYTICS_ADMIN_RPM`**). ETag cache dir: **`CURSOR_ANALYTICS_HTTP_CACHE_DIR`** (default **`kyleOutput/cursor-admin-http-cache/`**).

## Privacy

These CSVs often contain **emails and usage detail**. Only commit what your team is comfortable hosting on Netlify.

## Overrides

- **`CURSOR_ANALYTICS_SUMMARY_JSON`**: alternate summary path (absolute or repo-relative). Default is **`data/cursor-analytics/cursor-analytics-summary.json`** (see `src/constants/cursorAnalyticsPaths.ts`).
- Legacy private dumps can stay under **`cursor-analytics-new-screen/`** (still gitignored); point the summarizer with `--dir` / `--out` if needed.
