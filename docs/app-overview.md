# App Overview – What This Web App Is For

## Purpose

**CPT Group Internal Dashboard** is a web application built to run on **office TVs** (typically 5–7 screens) across the organization. It displays **team analytics, metrics, and data visualizations** for 24/7 viewing. Each TV navigates directly to a specific URL (e.g. `/tv/dev-corner-two` or `/tv/conference-room`); there is no per-user login—access is IP-restricted to internal networks.

## Audience & Context

- **Primary users**: Internal staff viewing information on shared office TVs.
- **Use case**: Ambient display of Jira stats, sprint/team metrics, and (future) lobby/conference/break-room content.
- **Operation**: 24/7; dashboards are designed to fit a single screen (no scrolling), with TV-friendly contrast and layout.

## What the App Does Today

| Area | Description |
|------|-------------|
| **Home (`/`)** | Card-based navigation to each TV dashboard. Large touch targets, theme-aware. |
| **TV routes (`/tv/...`)** | One dashboard per room. Each TV is pointed at a specific route. |
| **Dev Corner Two (`/tv/dev-corner-two`)** | **NOVA** Jira dashboard: open/today/late/done counts, bar chart by assignee, doughnut distribution, “By assignee” table with Open, Today, Late, Bugs, Done and conditional formatting. Data from Jira API (project NOVA), 5‑min cache, 1‑min refresh when stale. Client-only (dynamic import, no SSR) to avoid hydration issues. |
| **Conference Room (`/tv/conference-room`)** | Full-viewport dashboard with custom background image; placeholder content ready for future widgets (e.g. calendar, meetings). |
| **Other rooms** | `dev-corner-one`, `lobby`, `break-room` are defined in routes and on the home cards but currently render nothing (TVDashboard returns null). Ready for future dashboards. |

## Route Structure

- **`/`** – Home; dashboard selector (cards link to `/tv/{roomName}`).
- **`/tv/conference-room`** – Static route; renders `TVDashboard` with `roomName="conference-room"` (Conference Room dashboard with background).
- **`/tv/[roomName]`** – Dynamic route for any room; same `TVDashboard` by room name. Implements: `dev-corner-two` → NovaDashboard, `conference-room` → ConferenceRoomDashboard; others → null.

Room names and labels live in `src/constants/routes.ts` and `src/constants/DASHBOARD_LIST.ts`.

## Data & Integrations

- **Jira (NOVA)**: Used by Dev Corner Two. Server-side API via `src/services/api/jiraService.ts` and Next.js API routes under `src/app/api/jira/`. Credentials from env (e.g. `JIRA_BASE_URL`, `KYLE_EMAIL`, `KYLE_JIRA_TOKEN`). Store: `jiraNovaStore` (Zustand), 5‑min TTL, fetches open/today/overdue/done and derives by-assignee stats and bug counts.
- **Theme**: Light/dark from `public/themes/` (e.g. `cpt-legacy-dark`, `cpt-legacy-light`). Theme choice in localStorage; no global style overrides outside theme files per project rules.
- **Other data**: Architecture supports API, cron, and static JSON; only Jira is wired for a TV screen so far.

## Tech Stack (Relevant to This App)

- **Next.js** (App Router), **React**, **TypeScript**
- **PrimeReact** (Card, Chart, DataTable, Tag, Skeleton, etc.), **PrimeFlex**, **PrimeIcons**
- **Zustand** for TV dashboard state (e.g. Jira NOVA cache)
- **Chart.js** (via PrimeReact Chart) for bar and doughnut charts
- Styling: theme CSS + `globals.css` for layout (e.g. `.nova-dashboard-content`, `.conference-dashboard-content`)

## Design Conventions

- **TV screens**: Single-screen layout (no page scroll). Use `min-height: 100vh; max-height: 100vh; overflow: hidden` and flex so content (e.g. table) scrolls inside its area if needed.
- **No header/title on TV**: Room is known from the URL; no redundant “Dev Corner Two” or “Conference Room” title on the dashboard.
- **Console**: No `console.log`; check browser console for errors. See `docs/do-donts.md`.
- **Changelog & version**: Every notable change gets a CHANGELOG entry and a semantic version bump in `package.json`.

## Supporting Docs

- **`dashboard-planning.md`** – Route list, home design, dev dashboard structure (stats, charts, tables).
- **`data-architecture.md`** – JSON-driven data sources.
- **`jira-ticket-schema.md`** – Jira issue shape used for NOVA.
- **`cpt-group-website-info.md`** – Reference info from [CPT Group](https://www.cptgroup.com/) (stats, contact, value props) for reels and future content.
- **`versioning.md`** – Changelog and version rules.
- **`do-donts.md`** – Console, errors, and general do’s and don’ts.
- **`coding-style.md`**, **`primereact-theming.md`** – Code style and theming.

## Summary

This web app is the **internal TV dashboard for CPT Group**: it serves Jira-based NOVA metrics on Dev Corner Two, a branded Conference Room screen with custom background (and room for future content), and a home page to navigate to each room. Other rooms are stubbed for future dashboards. All TV views are built for one-screen, no-scroll, theme-aware display.
