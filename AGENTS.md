# AGENTS.md – Internal Dashboard

Context for AI coding agents working on this repo. See also README (if present) and CHANGELOG for human-facing docs and version history.

## Project overview

- **Stack**: Next.js 16, React 19, TypeScript, PrimeReact, Zustand, react-hook-form, Chart.js (date-fns adapter), SASS.
- **Purpose**: Internal TV dashboards and home screen (conference room, Julie’s Office, Dev Corner One/Two, etc.). Uses PrimeReact components and a shared theme system.

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
- **UI**: `src/components/pages/` (page-level dashboards), `src/components/ui/` (reusable pieces e.g. `BackgroundSlideshow`, `JiraMeterChart`, `TextScroller`).
- **Charts**: `src/components/charts/` — **presentation-only** chart components named by **purpose** (e.g. `OpenClosedAvgHoursByAssigneeRadarChart`, `OpenAndAvgDaysByAssigneeBarLineChart`, `ByBoardByComponentStackedBarChart`, `OpenedClosedFlowBarChart`, `HorizontalBarChart`, `GanttChart`). Each accepts only a typed `data` prop (and optional props like `noData` for Gantt); no store, no JQL, no wrappers (Card/Panel). Chart data types live in `src/types/charts/`. Mappers in `src/utils/chartDataMappers.ts` convert analytics (NovaAnalytics, OperationalAnalytics) into these types. Pages get analytics from the store → call the mapper → pass result to the chart; **wrappers and layout stay on the page**. Use these shared charts for any dashboard that needs the same visualization; add new chart components and types when a new purpose appears.
- **State**: Zustand stores (e.g. operational Jira, Trevor, Nova, Dev1) under `src/stores/`. Data fetching and JQL live at API/store level; chart components never fetch or transform raw analytics.
- **API**: Client calls go through `src/services/api/` – `apiClient` (fetch wrapper), `jiraSearchClient` (Jira search via `/api/jira/search`). Fine-tuned Jira calls live in `src/services/api/endpoints/jira/` (e.g. `getTicketsTransitionedToday`, `fetchUpdates(since)`); JQL for these in `jira/jql.ts`. Use `useJiraUpdatesPolling` for 30‑min polling of updated tickets. **Salesforce**: read-only server-side `salesforceService.ts` (OAuth2 password flow, describeGlobal, describeSObject, query); discovery routes `GET /api/salesforce/discover` and `GET /api/salesforce/query?q=SOQL`. **CPT TV OAuth (GET only)**: `salesforceOAuth.ts` – Authorization Code + PKCE; `GET /oauth/start`, `GET /oauth/callback` (tokens in `.sf_tokens.json`); `GET /api/sf/whoami`, `GET /api/sf/describe/support-channel`. No POST in this app; Support Portal (cpt-support-portal repo) has OAuth + POST /api/support-request for Support_Channel__c. See `docs/salesforce-oauth-and-support.md` and `docs/salesforce-discovery.md`.
- **Styles**: `src/styles/` — `variables.scss`, `base.scss`, `utilities.scss`, `themes/*.scss`, `primereact-overrides.scss`; orchestration in `src/app/main.scss`. Theme is driven by `data-theme` on `<html>` and theme variables; avoid inline styles for theme-driven UI when possible.

## TV routes and dashboards

- **Router**: `src/components/pages/TVDashboard/TVDashboard.tsx` — by `roomName`: `dev-corner-one` and `dev-corner-two` → `OperationalJiraDashboard`; `trevor` → `TrevorDashboard`; `conference-room` → `ConferenceRoomDashboard`; `jackie` → `JackiesOfficeDashboard`; `julie` → `JuliesOfficeDashboard`; others → `null`. Route slugs should match the dashboard/person name (e.g. `/tv/julie`, `/tv/jackie`, `/tv/trevor`). Home page titles and card labels (e.g. "Dev Corner One", "Julie's Office", "Jackie's Office") are **user-facing and stay as-is**; chart and component names in code are purpose-based.

## Conventions and rules

- **Theme and global styles**: Do **not** change theme, color, or global styles unless the user explicitly asks for it.
- **Changelog**: After every completed task, update `CHANGELOG.md` under `[Unreleased]` (Keep a Changelog format; use Added / Changed / Fixed etc. as appropriate).
- **Components**: Prefer functional components and clear, focused components; reuse shared UI from `src/components/ui/` where it fits. For **charts**: name by purpose (e.g. `OpenClosedAvgHoursByAssigneeRadarChart`), not by dashboard; accept only typed data props; put types in `src/types/charts/`, mappers in `src/utils/chartDataMappers.ts`; pages own Card/Panel and layout.
- **Types**: Keep TypeScript strict; use proper types for props and store state.

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

- Semantic versioning; see “Versioning Rules” in `CHANGELOG.md` (patch / minor / major and max 9 rule).

## Continual learning

- **Capture new conventions**: When a new pattern, convention, or project-specific decision emerges from conversation or code review (e.g. how to structure a new dashboard, naming, or where to put new files), add it to this file or to `.cursor/rules/` so future sessions and agents benefit.
- **Persist user preferences**: When the user corrects behavior or states a preference (e.g. "always do X" or "never change Y"), consider recording it in AGENTS.md or a Cursor rule so it applies consistently next time.
- **Keep AGENTS.md current**: When the stack, scripts, or layout change (new scripts, new folders, new conventions), update AGENTS.md so it stays the single source of context for agents.
