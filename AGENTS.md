# AGENTS.md – Internal Dashboard

Context for AI coding agents working on this repo. See also README (if present) and CHANGELOG for human-facing docs and version history.

## Project overview

- **Stack**: Next.js 16, React 19, TypeScript, PrimeReact, Zustand, react-hook-form, Chart.js (date-fns adapter), SASS.
- **Purpose**: Internal TV dashboards and home screen (conference room, Julie's Office, Dev Corner One/Two, etc.). Uses PrimeReact components and a shared theme system.

## The NOVA team

The dev team is called **NOVA** — *Nerds Of Vast Automation*. Four members:

| Name | Jira accountId |
|---|---|
| Kyle Dilbeck | `712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f` |
| James Cassidy | `712020:4a657f3c-6d1e-41be-88fc-e168a5e75cbd` |
| Roy R | `712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837` |
| Thomas Williams | `712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef` |

Constant: `NOVA_TEAM.ts` (IDs, display names, ordered list for charts, `isNovaTeamMember` helper).

## Jira workflow and projects

Three Jira projects feed the dashboards:

- **CM (Case Management)** — High-volume; case managers (e.g. Alejandra) create tickets in **"New"** status while prepping info. Dev team doesn't see or touch "New" items. Work becomes visible to devs at **To Do → Data Team New → Requested**. Then: **In Progress → Team Testing → QA → Dev Review → UAT → Done**. Tickets bounce between teams — the "tech owner" field is the actual developer, but assignee can change as work is handed off.
- **OPRD (Operational/Prod Support)** — Bug fixes, operational tasks. Same status exclusion: **"New"** is skipped. Dev work starts when status moves beyond New.
- **NOVA (Software Development)** — Internal tools, dashboards, new features. Legacy issues below NOVA-661 are excluded via client-side `filterIssuesNovaMinKey`.

### JQL scoping rules

All operational JQL (Dev Corner dashboards) follows these rules:
- **CM**: `status != New`, `statusCategory != Done`, component IN dev-relevant list (Interactive Website, Case Database, NCOA/ACS, Static Website, Web Database, Downloader, Weekly Reports, SCP, Shut Down Service, Data Analysis, Database Migration, Website). No Epics.
- **OPRD**: `status != New`, `statusCategory != Done`, same component list. No Epics.
- **NOVA**: `statusCategory != Done`, no Epics/Sub-tasks. Client-side filter: key >= NOVA-661.

Time-based queries (created/resolved today/14d) use the same scoped filter so flow data reflects dev work only, not all project activity.

## Dev environment

- **Install**: `npm install`
- **Env**: Copy or create `.env.local` for any required env vars (e.g. JIRA/API keys if used). Do not commit secrets.
- **Dev server**: `npm run dev` — runs build-time scripts then starts Next.js on port **3333**.
- **Build**: `npm run build` — same scripts then production build.
- **Lint**: `npm run lint` (ESLint; type-aware rules on `src/**`).

Do **not** run `next dev` (or `next build`) directly without the scripts; slide lists and other generated data can be stale.

## Build-time scripts

These run automatically before `dev` and `build`:

- `scripts/generate-conference-slides.js` — reads `public/backgrounds/conference-room/`, writes `conferenceBackgroundSlides.generated.ts`.
- `scripts/generate-julies-background-slides.js` — reads `public/backgrounds/julies-unicorns/`, writes `juliesBackgroundSlides.generated.ts`.
- `scripts/generate-jackies-background-slides.js` — reads `public/backgrounds/jackies-cute-backgrounds/`, writes `jackiesBackgroundSlides.generated.ts`.

Add/remove images in those folders and re-run `npm run dev` or `npm run build` to refresh. Generated `.generated.ts` files are committed. All background image folders live under `public/backgrounds/`.

## Code layout

- **Paths**: Use `@/` for `src/` (e.g. `@/components/ui/...`, `@/styles/...`).
- **App**: `src/app/` (Next.js App Router), `src/app/layout.tsx`, routes under `src/app/tv/...`.
- **UI**: `src/components/pages/` (page-level dashboards), `src/components/ui/` (reusable pieces e.g. `BackgroundSlideshow`, `JiraMeterChart`, `TextScroller`, `CornerInfoCard`, `TrendBadge`, `KpiStrip`).
- **Charts**: `src/components/charts/` — **presentation-only** chart components named by **purpose** (e.g. `OpenClosedAvgHoursByAssigneeRadarChart`, `OpenedClosedFlowBarChart`, `HorizontalBarChart`, `GanttChart`). Each accepts only a typed `data` prop; no store, no JQL, no wrappers (Card/Panel). Chart data types live in `src/types/charts/`. Mappers in `src/utils/chartDataMappers.ts` convert analytics into these types. Pages get analytics from the store → call the mapper → pass result to the chart; **wrappers and layout stay on the page**.
- **State**: Zustand stores under `src/stores/`. Data fetching and JQL live at API/store level; chart components never fetch or transform raw analytics.
- **Jira API**: Uses **v3 REST API** (`POST /rest/api/3/search/jql`) with cursor-based pagination (`nextPageToken`, `isLast`). V3 does **not** return `total`; the service auto-paginates up to 1000 results (10 pages × 100). Auth: Basic with `KYLE_EMAIL` + `KYLE_JIRA_TOKEN` from `.env.local`. **Changelog API**: `GET /rest/api/3/issue/{key}/changelog` fetches status transition history; used to extract exact dates when CM/OPRD tickets transitioned FROM "New" (when work landed on dev team). Route: `GET /api/jira/transitions?keys=CM-123,CM-456`.
- **API**: Client calls go through `src/services/api/` – `apiClient` (fetch wrapper), `jiraSearchClient` (Jira search via `/api/jira/search`, transition dates via `/api/jira/transitions`). Fine-tuned Jira calls in `src/services/api/endpoints/jira/`. **Salesforce**: read-only server-side `salesforceService.ts`; see `docs/salesforce-*.md`.
- **Styles**: `src/styles/` — `variables.scss`, `base.scss`, `utilities.scss`, `themes/*.scss`, `primereact-overrides.scss`; orchestration in `src/app/main.scss`. Theme is driven by `data-theme` on `<html>` and theme variables; avoid inline styles for theme-driven UI when possible.

## TV routes and dashboards

- **Router**: `src/components/pages/TVDashboard/TVDashboard.tsx` — by `roomName`: `dev-corner-one` → `DevCornerOneDashboard`; `dev-corner-two` → `OperationalJiraDashboard`; `trevor` → `TrevorDashboard`; `conference-room` → `ConferenceRoomDashboard`; `jackie` → `JackiesOfficeDashboard`; `julie` → `JuliesOfficeDashboard`. Route slugs match the dashboard/person name.

### Dev Corner physical layout and dashboard philosophy

Dev Corner One and Two are TVs **side-by-side** in the 2nd-floor office, near the entrance and break room. Other departments walk by daily.

- **Dev Corner One (LEFT TV)** — **Developer-focused**. Closest to the dev desks. Shows actionable metrics the NOVA team cares about: throughput trends, component analytics (opened today/this week per component), avg close time, team workload. Scoped to NOVA team members only. Single-view, no carousel.
- **Dev Corner Two (RIGHT TV)** — **Company-facing**. Visible to non-dev employees walking by. Shows what's actively being worked on: in-progress ticket cards, recently completed items, general progress. More visual and accessible to anyone. Carousel format (may switch to single-view later).

**Non-redundancy rule**: Dev 1 and Dev 2 must NOT show duplicate data. Each dashboard has unique analytics and views. If a metric appears on Dev 1, it should not also appear on Dev 2.

### Auto-refresh strategy

All TV dashboards use a dual-refresh approach:
- **Soft re-fetch**: Zustand stores poll every 60s and re-fetch if stale (cache TTL 30 min). Data updates without page flicker.
- **Hard page reload**: Full `window.location.reload()` every few hours to ensure clean state, clear memory leaks, and pick up any deployed code changes. Configurable interval.

### Analytics dashboards (Dev Corner, Trevor)

Data flow:
```
JQL constants → Zustand store (fetch + cache) → analytics builder → chart data mapper → chart component
```

**Stores** (`src/stores/`):
- `operationalJiraStore` — Dev Corner One/Two. Fetches 7 parallel JQL queries (open, landed today, closed today, landed last 14d, resolved last 14d, landed prev 14d, resolved prev 14d) + batch changelog fetch for CM/OPRD transition dates. "Landed" = transition-based (when work became visible to dev team). Builds `OperationalAnalytics` with derived indicators: `throughputRatio`, `riskScore`, `agingHotspots`, `trendVsPrevious14d`. Polls every 60s if stale; cache TTL 30 min.
- `trevorJiraStore` — Trevor's Screen. Fetches team-scoped tickets (NOVA team across OPRD/CM/NOVA, last 6 months). Builds `NovaAnalytics`.
- `jiraNovaStore` — NOVA project analytics (open/today/overdue/done).
- `dev1JiraStore` — Dev Corner One extended analytics (NOVA, last 6 months).
- All stores filter with `filterIssuesNovaMinKey` (NOVA-661+) to exclude legacy issues.

**JQL constants** (`src/constants/`):
- `JIRA_SHARED.ts` — cache TTL (30 min), max results (1000).
- `JIRA_OPERATIONAL.ts` — multi-project queries (CM + OPRD + NOVA) with dev-component and status scoping. **"Landed on team"** queries use `status changed FROM "New"` for CM/OPRD and `created` for NOVA. See "JQL scoping rules" above.
- `JIRA_TREVOR.ts` — NOVA team queries (assignee-scoped).
- `JIRA_NOVA.ts` — NOVA project queries (min key 661).
- `JIRA_DEV1.ts` — Dev Corner One queries.
- `NOVA_TEAM.ts` — NOVA team member IDs, display names, ordered list for charts.

**Chart data mappers** (`src/utils/chartDataMappers.ts`):
- `toOpenedClosedFlowChartData` — 14-day opened vs closed flow.
- `toBacklogByComponentBarChartData` — backlog by component horizontal bars.
- `toAgingBucketsBarChartData` — aging bucket horizontal bars.
- `toWorkloadByAssigneeChartData` — workload bars per assignee with % of total.
- `toAgingHotspotsBarChartData` — aging hotspot labels + avg age values.
- `toOpenClosedAvgHoursByAssigneeRadarChartData` — radar chart (open/closed/avg hours per assignee).
- `toOpenAndAvgDaysByAssigneeChartData` — bar+line (open count + avg days per assignee).
- `toByBoardByComponentChartData` — stacked bar (by project × component).

**Chart components** (`src/components/charts/`) — all presentation-only, typed data prop:
- `OpenedClosedFlowBarChart` — vertical bar (opened vs closed by day).
- `HorizontalBarChart` — horizontal bars with optional per-bar colors.
- `OpenClosedAvgHoursByAssigneeRadarChart` — radar (3 datasets: open, closed, avg hours).
- `OpenAndAvgDaysByAssigneeBarLineChart` — combo bar+line (open count + avg days).
- `ByBoardByComponentStackedBarChart` — stacked horizontal (project × component).
- `GanttChart` — timeline (start/end dates, progress).

### Slideshow dashboards (Conference, Julie, Jackie)

These dashboards display rotating background images with optional overlays. See "Build-time scripts" for image generation. They use `BackgroundSlideshow` (reusable UI) and `CornerInfoCard` (name badge). Layout: full viewport, no scroll, position-absolute overlays.

## Conventions and rules

- **Theme and global styles**: Do **not** change theme, color, or global styles unless the user explicitly asks for it.
- **Changelog**: After every completed task, update `CHANGELOG.md` under `[Unreleased]` (Keep a Changelog format; use Added / Changed / Fixed etc. as appropriate).
- **Components**: Prefer functional components and clear, focused components; reuse shared UI from `src/components/ui/` where it fits. For **charts**: name by purpose, not by dashboard; accept only typed data props; put types in `src/types/charts/`, mappers in `src/utils/chartDataMappers.ts`; pages own Card/Panel and layout.
- **Types**: Keep TypeScript strict; use proper types for props and store state. Never use `any` or `unknown`.
- **File size**: Max ~300 lines per TSX file. If larger, extract sub-components. Exceptions OK for CSS/SCSS files and analytics builders.
- **Naming**: PascalCase components, camelCase hooks, UPPER_SNAKE_CASE static constants. Barrel exports (`index.ts`) in all library folders.
- **Non-redundancy**: Dev Corner One and Two show unique data — no duplicated panels or metrics between them.

## Pre-commit checklist

Before every commit and push:

1. **Regenerate background slide lists** — run all three scripts (or just `npm run dev` / `npm run build` which runs them automatically). Images may have been added/removed since last generation.
   ```bash
   node scripts/generate-conference-slides.js
   node scripts/generate-julies-background-slides.js
   node scripts/generate-jackies-background-slides.js
   ```
   Stage the updated `.generated.ts` files along with any new/removed images.
2. **Run `npm run lint`** before considering a task done.
3. **Ensure `npm run build` succeeds** when touching code that affects the build or generated files.

## Versioning

- Semantic versioning; see "Versioning Rules" in `CHANGELOG.md` (patch / minor / major and max 9 rule).

## Continual learning

- **Capture new conventions**: When a new pattern, convention, or project-specific decision emerges from conversation or code review, add it to this file or to `.cursor/rules/` so future sessions and agents benefit.
- **Persist user preferences**: When the user corrects behavior or states a preference, record it in AGENTS.md or a Cursor rule so it applies consistently.
- **Keep AGENTS.md current**: When the stack, scripts, or layout change, update AGENTS.md so it stays the single source of context for agents.
