# Cursor usage / cost exports (legacy scratch)

**Use the tracked folder instead:** **`data/cursor-analytics/csv/`** — CSVs and the generated summary there are **committed** for Netlify; see **`data/cursor-analytics/README.md`**.

This directory remains **gitignored** (except this README and `.gitkeep`) so you can drop sensitive exports locally without committing them.

## Old commands (still work with explicit paths)

```bash
node scripts/cursor-analytics/summarize-cursor-exports.mjs --dir cursor-analytics-new-screen --out kyleOutput/cursor-analytics-summary.json
```

For the app default, set **`CURSOR_ANALYTICS_SUMMARY_JSON`** to that output path, or prefer **`npm run cursor-analytics:regen`** which targets **`data/cursor-analytics/`**.
