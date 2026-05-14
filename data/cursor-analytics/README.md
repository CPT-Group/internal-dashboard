# Cursor analytics (tracked)

This tree is **not gitignored** so CSV exports and the generated summary can ship with the repo (e.g. **Netlify**).

## Layout

| Path | Role |
|------|------|
| **`csv/`** | Drop **any** `*.csv` from Cursor’s team Analytics exports here. All CSVs in this folder are merged by the summarizer. |
| **`cursor-analytics-summary.json`** | Generated JSON consumed by **`GET /api/cursor-analytics`** (default). Rebuilt on **`npm run dev`** / **`npm run build`** via `predev` / `prebuild`, and when you run **`npm run cursor-analytics:regen`**. |

## Workflow

1. Export CSVs from the Cursor web dashboard (Analytics).
2. Add or replace files under **`csv/`** (commit when you want production to pick them up).
3. Run **`npm run cursor-analytics:regen`** (or just **`npm run dev`** / **`npm run build`**) to refresh **`cursor-analytics-summary.json`**.

## Privacy

These CSVs often contain **emails and usage detail**. Only commit what your team is comfortable hosting on Netlify.

## Overrides

- **`CURSOR_ANALYTICS_SUMMARY_JSON`**: alternate summary path (absolute or repo-relative). Default is **`data/cursor-analytics/cursor-analytics-summary.json`** (see `src/constants/cursorAnalyticsPaths.ts`).
- Legacy private dumps can stay under **`cursor-analytics-new-screen/`** (still gitignored); point the summarizer with `--dir` / `--out` if needed.
