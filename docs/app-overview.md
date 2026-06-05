# App Overview – What This Web App Is For

## Purpose

**CPT Group Internal Dashboard** is a Next.js app built to run on **office TVs** and a few desktop routes (Website Health, Cursor analytics). Each TV navigates directly to a URL (e.g. `/tv/dev-corner-one` or `/tv/conference-room`); there is no per-user login on TV routes—access is IP-restricted to internal networks.

## Audience & Context

- **Primary users**: Internal staff viewing information on shared office TVs; case managers and devs on Website Health.
- **Use case**: Ambient display of Jira operational metrics, GitHub deploy status, slideshow backgrounds, and (locally) website submission health checks.
- **Operation**: TVs run 24/7 with auto-refresh (soft poll + periodic full page reload). Layouts are single-screen, no page scroll.

## What the App Does Today

| Area | Route | Description |
|------|-------|-------------|
| **Home** | `/` | Card-based navigation to each TV dashboard. Theme switcher (home only). |
| **Dev Corner One** | `/tv/dev-corner-one` | Developer-focused: KPI strip (Limbo, Landed/Closed Today, throughput), Work Hours Today, Impediments, NOVA Team Activity. Uses shared `operationalJiraStore`. |
| **Dev Corner Two** | `/tv/dev-corner-two` | Company-facing carousel: In Progress, Recently Completed, Requested, Completions by dev, GitHub CD deploy status. Same operational Jira data, different panels than Dev Corner One. |
| **Trevor's Screen** | `/tv/trevor` | NOVA-focused mobile-friendly view: KPIs, board×component chart, team load, NOVA tickets table. |
| **Conference Room** | `/tv/conference-room` | Full-viewport rotating background slideshow. |
| **Jackie's Office** | `/tv/jackie` | Rotating backgrounds + corner name badge. |
| **Julie's Office** | `/tv/julie` | Rotating unicorn-themed backgrounds + corner name badge. |
| **GitHub activity** | `/tv/github-activity` | Webhook delivery feed carousel (route works when opened directly; may not appear on home cards). |
| **Website Health** | `/website-health` | Mobile-first discrepancy scanner (not a TV route). |
| **Cursor analytics** | `/cursor-analytics` | Team usage dashboard (optional password gate). |

Room names and home-card labels live in `src/constants/routes.ts` and `src/constants/DASHBOARD_LIST.ts`. Routing is implemented in `src/components/pages/TVDashboard/TVDashboard.tsx`.

## Route Structure

- **`/`** – Home; dashboard selector.
- **`/tv/[roomName]`** – Dynamic TV route; `TVDashboard` switches on `roomName` to the dashboards listed above.
- **`/website-health`**, **`/cursor-analytics`** – Non-TV routes.

## Data & Integrations

- **Operational Jira (CM + OPRD + NOVA)**: Shared `operationalJiraStore` powers Dev Corner One, Dev Corner Two, and Trevor's Screen. Server API via `src/services/api/` and routes under `src/app/api/jira/`. Credentials: `KYLE_EMAIL`, `KYLE_JIRA_TOKEN` (see `.env.example`). Cache TTL: **20 min** business hours / **60 min** off-hours Pacific (`getJiraCacheTtl()`).
- **GitHub**: Deploy status (Actions API) on Dev Corner Two; webhook cache for `/tv/github-activity`. Optional tokens in `.env.local`.
- **SQL Server**: Website Health compares website `Submissions` (prod host) vs 2K16 `CleanClaims`. Requires VPN + `DB_*` / `PROD_DB_*` env vars.
- **Theme**: SCSS variables + `data-theme` on `<html>` (dark-synth default). See `docs/theme-system.md`.

## Dev & Production Ports

| Command | Port | Notes |
|---------|------|-------|
| `npm run dev` | **3333** | Always use this script (not bare `next dev`) — runs slide-list and cursor-analytics predev scripts. |
| `npm run build` then `npm start` | **3000** | Production server default. |

Open [http://localhost:3333](http://localhost:3333) after `npm run dev`.

## Agent & Developer Docs

- **`AGENTS.md`** (repo root) – Canonical context for AI agents: Jira workflow, analytics rules, env vars, validation (`npm run lint`, `npm run typecheck`, `npm run build`).
- **`.env.example`** – Copy to `.env.local`; no secrets in repo.

## Supporting Docs

- `docs/theme-system.md` – Theme tokens and usage.
- `docs/data-architecture.md` – JSON-driven data sources.
- `docs/jira-ticket-schema.md` – Jira issue shape for NOVA.
- `CHANGELOG.md` – Version history.

## Summary

This app is CPT Group's **internal TV dashboard suite**: operational Jira analytics on Dev Corner TVs, GitHub deploy visibility for the wider office, branded slideshow rooms, plus Website Health and Cursor analytics for desk use. Dev Corner One and Dev Corner Two intentionally show **different** panels from the same underlying store (non-redundancy rule—see `AGENTS.md`).
