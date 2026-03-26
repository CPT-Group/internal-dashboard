# AGENTS.md – Internal Dashboard

Context for AI coding agents working on this repo. See also README (if present) and CHANGELOG for human-facing docs and version history.

## Project overview

- **Stack**: Next.js 16, React 19, TypeScript, PrimeReact, Zustand, react-hook-form, Chart.js (date-fns adapter), SASS.
- **Purpose**: Internal TV dashboards and home screen (conference room, Julie's Office, Dev Corner One/Two, etc.). Uses PrimeReact components and a shared theme system.

## The NOVA team

The dev team is called **NOVA** — *Nerds Of Vast Automation*. Five members:

| Name | Jira accountId | Jira displayName |
|---|---|---|
| Roy | `712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f` | royr |
| Kyle Dilbeck | `712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837` | Kyle Dilbeck |
| James Cassidy | `712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef` | James Cassidy |
| Brandon Fay | `712020:384111d1-8f9d-4155-8420-37ff1888d6c3` | Brandon Fay |
| Carlos | `712020:47cb6286-8794-44bf-bcb8-6ca1b6aadb79` | Carlos |

Verified against Jira REST API (`GET /rest/api/3/user?accountId=...`) on 2026-02-24.

Constant: `NOVA_TEAM.ts` (IDs, display names, ordered list for charts, `isNovaTeamMember` helper). The array order matters — IDs and display names are matched by index.

**Former devs (excluded from TV metrics):** Thomas Williams (`712020:4a657f3c-6d1e-41be-88fc-e168a5e75cbd`) is listed in `DASHBOARD_EXCLUDED_ACCOUNT_IDS` — issues where he is assignee or tech owner are dropped from `buildOperationalAnalytics` so dashboards ignore his attribution. He is not in `assignee IN (...)` JQL for NOVA team scope.

## Jira workflow and projects

Three Jira projects feed the dashboards:

- **CM (Case Management)** — High-volume; case managers (e.g. Alejandra) create tickets in **"New"** status while prepping info. Dev team doesn't see or touch "New" items. Work becomes visible to devs at **Data Team New** or **Requested**. Then: **Data Team In Progress → Data Team Testing → Data Team Complete** (back to CMs for UAT). Tickets bounce between teams — the "tech owner" field is the actual developer, but assignee can change as work is handed off. When devs complete a ticket they assign it back to the requester for final UAT/approval.
- **OPRD (Operational/Prod Support)** — Bug fixes, operational tasks. Flow: **TO DO** (requested/waiting) → **Requirement Review** (optional) → **Development** (actively working) → **Peer Testing** → **QA/QC** → **UAT** → **Resolved**. Same "New" exclusion: dev work starts at TO DO.
- **NOVA (Software Development)** — Internal tools, dashboards, new features. Simple linear flow: **To Do** (requested) → **In Progress** → **Dev Review** → **QA** → **Done**. Legacy issues below NOVA-661 are excluded via client-side `filterIssuesNovaMinKey`.

### Status definitions for analytics

| Concept | OPRD | CM | NOVA |
|---------|------|-----|------|
| **Requested / not started** | TO DO, Requirement Review | DATA TEAM NEW, REQUESTED | TO DO |
| **Actively working** | Development | Data Team In Progress | In Progress |
| **Dev complete / testing** | Peer Testing, QA/QC | Data Team Testing | Dev Review, QA |
| **Back to requesters** | UAT | Data Team Complete | — |
| **Done** | Resolved | Request Complete | Done |

These status mappings drive the `isRequestedNotStarted()` helper in `operationalAnalytics.ts` and the "Requested — Not Yet Started" slide on Dev Corner Two.

### JQL scoping rules

All operational JQL (Dev Corner dashboards) mirrors the "Case Management Data Team Board" filter (V.3). The board filter JQL lives in `src/constants/JIRA_OPERATIONAL.ts`.

- **CM**: `status != New`, `statusCategory != Done`, component IN dev-relevant list (Interactive Website, Case Database, NCOA/ACS, Static Website, Web Database, Downloader, Weekly Reports, SCP, Shut Down Service, Data Analysis, Database Migration, Website). No Epics.
- **OPRD**: Two clauses OR'd: (1) `labels IN ("linked-to-CM")` no Epics, (2) `status != New`, `statusCategory != Done`, same component list, no Epics.
- **NOVA**: `assignee IN (NOVA_TEAM)`, `sprint in openSprints()`, `statusCategory != Done`. Only shows team members' tickets in active sprints — not the entire project backlog.

Time-based queries (created/resolved today/14d) use the same scoped filter so flow data reflects dev work only, not all project activity.

### Tech Owner vs Assignee

Jira custom field `customfield_10193` (**Tech Owner**) identifies the developer who actually does the work. The standard **assignee** changes throughout the ticket lifecycle — devs are assigned while in progress, but when they finish they reassign to the CM for UAT/approval. At resolution time the assignee is typically the CM, **not** the dev who built it.

**Rules for analytics attribution:**
- **Recently Completed, Closed Today, Avg Close Time, Throughput, Flow chart (resolved side), Trend comparisons** — always use **Tech Owner** (`customfield_10193`). Filter to NOVA team tech owners so metrics only count dev-team work.
- **In-Progress, Team Activity, Dev Load Matrix, Workload** — use **assignee** (correct because the dev is assigned while actively working).
- **Requested / Not Started** — analytics still keys off **assignee** for “who has it now”; Dev Corner Two also displays **Tech Owner** separately so viewers see intended dev vs current assignee.

**NOVA Components** (`customfield_10754`): On NOVA project issues, this field (e.g. ZION, Legacy/Other) is used for Dev Load matrix bucketing and component text in Dev 2 tables when set; if empty, behavior falls back to standard Jira **components** or “No component”. CM/OPRD continue to use standard components only.

The field is fetched as part of `DEFAULT_JIRA_FIELDS` in `jiraService.ts` and typed on `JiraIssueFields` as `customfield_10193: JiraUser | null`. Helpers `getTechOwnerName()`, `getTechOwnerAccountId()`, and `isTechOwnerNovaTeam()` in `operationalAnalytics.ts` centralize access.

### NOVA ticket hygiene

NOVA tickets older than 14 days with no recent updates should be closed periodically to keep metrics accurate (avg age, oldest, open count). A cleanup was performed 2026-02-24 closing 36 stale tickets. If counts drift again, run a similar JQL: `project = NOVA AND statusCategory != Done AND updated < "-14d"` and transition to Done.

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
- **UI**: `src/components/pages/` (page-level dashboards), `src/components/ui/` (reusable pieces e.g. `BackgroundSlideshow`, `JiraMeterChart`, `TextScroller`, `CornerInfoCard`, `TrendBadge`, `KpiStrip`, **`DevCornerSlideHero`**). **Dev Corner Two** slide titles use `DevCornerSlideHero` with theme-driven tokens from `variables.scss`: `--slide-hero-bg`, `--slide-hero-pill-bg`, `--slide-hero-pill-border` (all derived from `var(--primary-color)` — no per-theme duplicate; switching theme updates primary and the hero automatically). Do not hardcode hex colors in slide headers; use these variables or `color-mix` with `var(--primary-color)`.
- **Charts**: `src/components/charts/` — **presentation-only** chart components named by **purpose** (e.g. `OpenClosedAvgHoursByAssigneeRadarChart`, `OpenedClosedFlowBarChart`, `HorizontalBarChart`, `GanttChart`). Each accepts only a typed `data` prop; no store, no JQL, no wrappers (Card/Panel). Chart data types live in `src/types/charts/`. Mappers in `src/utils/chartDataMappers.ts` convert analytics into these types. Pages get analytics from the store → call the mapper → pass result to the chart; **wrappers and layout stay on the page**.
- **State**: Zustand stores under `src/stores/`. Data fetching and JQL live at API/store level; chart components never fetch or transform raw analytics.
- **Jira API**: Uses **v3 REST API** (`POST /rest/api/3/search/jql`) with cursor-based pagination (`nextPageToken`, `isLast`). V3 does **not** return `total`; the service auto-paginates up to 1000 results (10 pages × 100). Auth: Basic with `KYLE_EMAIL` + `KYLE_JIRA_TOKEN` from `.env.local`. **Changelog API**: `GET /rest/api/3/issue/{key}/changelog` fetches status transition history; used to extract exact dates when CM/OPRD tickets transitioned FROM "New" (when work landed on dev team). Route: `GET /api/jira/transitions?keys=CM-123,CM-456`. **Worklog API**: `GET /rest/api/3/issue/{key}/worklog` for time tracking; JQL `worklogDate >= startOfDay() AND worklogAuthor in (...)` finds issues. Route: `GET /api/jira/worklogs-today?accountIds=id1,id2`. Polled via `useWorkHoursToday` hook (10-min interval).
- **API**: Client calls go through `src/services/api/` – `apiClient` (fetch wrapper), `jiraSearchClient` (Jira search via `/api/jira/search`, transition dates via `/api/jira/transitions`). Fine-tuned Jira calls in `src/services/api/endpoints/jira/`. **Salesforce**: read-only server-side `salesforceService.ts`; see `docs/salesforce-*.md`.
- **Styles**: `src/styles/` — `variables.scss`, `base.scss`, `utilities.scss`, `themes/*.scss`, `primereact-overrides.scss`; orchestration in `src/app/main.scss`. Theme is driven by `data-theme` on `<html>` and theme variables; avoid inline styles for theme-driven UI when possible.

## TV routes and dashboards

- **Router**: `src/components/pages/TVDashboard/TVDashboard.tsx` — by `roomName`: `dev-corner-one` → `DevCornerOneDashboard`; `dev-corner-two` → `DevCornerTwoDashboard`; `trevor` → `TrevorDashboard`; `conference-room` → `ConferenceRoomDashboard`; `jackie` → `JackiesOfficeDashboard`; `julie` → `JuliesOfficeDashboard`; `github-activity` → `GithubActivityDashboard`. Route slugs match the dashboard/person name.

### GitHub webhooks (receiver + TV)

- **GitHub “Payload URL”** must be your deployed app: **`https://<host>/api/webhooks/github`** — not a Teams Incoming Webhook URL. GitHub sends `POST` with `X-GitHub-Event`, `X-GitHub-Delivery`, and (if you set a secret) `X-Hub-Signature-256`. Teams webhooks expect different JSON; use Teams only as an optional **mirror** after our route processes the event.
- **Env**: `GITHUB_WEBHOOK_SECRET` — same value as GitHub’s webhook secret (HMAC SHA256 verification). **`GITHUB_WEBHOOK_CPT_GROUP`** — optional Microsoft Teams Incoming Webhook URL; we POST a short `{ "text": "..." }` line per delivery (failures do not fail the webhook).
- **Cache**: in-memory ring buffer (`GITHUB_WEBHOOK_CACHE_MAX_EVENTS`, age prune in `src/lib/githubWebhookCache.ts`). On serverless, cache is **per instance** and resets on cold starts — fine for a TV feed of recent activity.
- **TV** `/tv/github-activity`: carousel **30s × 3 slides + 120s** on the feed slide; polls **`GET /api/webhooks/github`** every **`GITHUB_ACTIVITY_POLL_INTERVAL_MS`** (60s). Same hard page reload as other TVs via `usePageAutoRefresh` + `getPageReloadInterval()`.

### GitHub Actions — CD deploy status (Dev Corner Two)

- **Env**: **`GITHUB_DEPLOY_READ_TOKEN`** — Personal Access Token (server only; never `NEXT_PUBLIC_*`). Needs **`actions:read`** on the monitored repos (and **`repo`** if they are private). Used by **`GET /api/github/deploy-status`**, which calls the GitHub REST API for each CD workflow listed in **`GITHUB_DEPLOY_WORKFLOW_MONITORS`** (`src/constants/GITHUB_DEPLOY_MONITORS.ts`).
- **Dev Corner Two slide 7** (`GithubDeployStatusSlide`): **`MeterGroup`** summary strip (idle OK / running / attention), reusable **`GithubDeployRepoCards`** — 2×2 **PrimeReact Card** grid for the four main deploy pipelines (Azure Functions API, internal tools SWA, NuGet publish, EF migrations), left-column **DataView** “Recent actions” feed, and right-side **Timeline** of recent runs across monitored repos. Cards use **Tag** status, indeterminate **ProgressBar** when a run is active, left-border health cues (green/yellow/red), and link to the run. Timeline/status spacing is tuned with an opposite-column status label. Both feed and timeline reuse existing `useAutoScroll` (no custom scroller). API includes `recentRuns` per monitored workflow so history widgets can render without extra GitHub calls. Repo color coding is theme-driven via `--github-repo-*` tokens in `variables.scss` + theme overrides (dark-synth/dark/light/ms-access). Helpers in **`githubDeployDisplay.ts`**. Polls every **`GITHUB_ACTIVITY_POLL_INTERVAL_MS`** (60s). Not the same as the webhook delivery feed on `/tv/github-activity`.

### Dev Corner physical layout and dashboard philosophy

Dev Corner One and Two are TVs **side-by-side** in the 2nd-floor office, near the entrance and break room. Other departments walk by daily.

- **Dev Corner One (LEFT TV)** — **Developer-focused**. Closest to the dev desks. Single-view layout:
  - KPI strip: Open, Landed Today, Closed Today, Net, Avg Close Time, Throughput Ratio.
  - Middle left: **Work Hours Today** — horizontal bar chart showing hours logged today (Pacific time) per core dev (Kyle, Roy, James). Uses `useWorkHoursToday` hook (10-min poll). Data from Jira worklog API via `/api/jira/worklogs-today`.
  - Middle right: Component Activity table (per-component: open, today, this week).
  - Bottom: NOVA Team Activity panel (4 dev cards with in-progress ticket chips).
  - Scoped to NOVA team; component `ComponentActivityPanel`, `TeamActivityPanel`, `ThroughputPanel`.
- **Dev Corner Two (RIGHT TV)** — **Company-facing**. Visible to non-dev employees. 7-slide carousel with **per-slide dwell** (`SLIDE_DURATIONS_MS` in `DevCornerTwoDashboard.tsx`): **15s** for slides 1–6; **60s** for slide 7 (GitHub deploy):
  - Slide 1: In-Progress ticket cards (card grid with key, summary, status, assignee, age); keys starting with `NOVA-` use the same nova accent styling as Dev 1 chips.
  - Slide 2: Recently Completed table (last 7 days, **Completed by** = Tech Owner, filtered to NOVA team devs); `NOVA-` rows highlighted.
  - Slide 3: Requested — Not Yet Started table (**Tech owner** + **Assignee**); `NOVA-` rows highlighted.
  - Slide 4: **Today** — close times by component (resolved **today**, same scope as operational closed-today KPI): per component, count, avg hours to close, fastest close today and tech owner (CM + OPRD + NOVA; NOVA team tech owners only). `TodayComponentVelocitySlide`; data: `todayComponentVelocity` from `buildOperationalAnalytics`.
  - Slide 5: Developer Load Matrix — **components as rows**, **assignees as columns** (NOVA team); matrix buckets NOVA tickets by **NOVA Components** when set. First column uses fixed table width so dev columns are not squeezed.
  - Slide 6: **Completions by developer** — custom layout (`CompletedByDevSlide`): per NOVA team member, tickets completed **today** (from `closedTodayIssues`) and **earlier this week** (Mon–Fri window through today, from `resolvedLast14`; excludes today’s keys in the “earlier” list to avoid duplicates). No extra Jira API calls.
  - Slide 7: **GitHub — CD deploy status** (`GithubDeployStatusSlide`): **`GET /api/github/deploy-status`** (Actions API + `GITHUB_DEPLOY_READ_TOKEN`). **`DEV_CORNER_TWO_FIXED_SLIDE_INDEX`** in `DevCornerTwoDashboard.tsx` can pin the carousel on this slide (`6` in 0-based); set to `null` for normal rotation.
  - KPI strip: In Progress, Completed (7d), Requested, Open (Prod), Open (NOVA). **No total "Open"** — that's on Dev 1 (non-redundancy rule). Prod = CM + OPRD.
  - Components: `InProgressCardsSlide`, `RecentlyCompletedSlide`, `RequestedTicketsSlide`, `TodayComponentVelocitySlide`, `DevLoadMatrixSlide`, `CompletedByDevSlide`, `GithubDeployStatusSlide`.

- **Trevor's Screen** — **NOVA-focused, mobile-friendly**. Single-view layout:
  - KPI strip: NOVA Active, In Progress, To Do, Review/QA, Total Open.
  - Top-left: By Board & Component stacked bar chart (CM/OPRD/NOVA with component breakdown).
  - Bottom-left: NOVA Team Load horizontal bar chart (open tickets per dev, sorted descending).
  - Right: NOVA Tickets table (all active NOVA tickets sorted by status, with auto-scroll).
  - Uses `operationalJiraStore` (same data as Dev Corner). No Gantt, no radar, no bar+line.

**Non-redundancy rule**: Dev 1 and Dev 2 must NOT show duplicate data. Each dashboard has unique analytics and views. If a metric appears on Dev 1, it should not also appear on Dev 2.

### Auto-refresh strategy

All TV dashboards use a dual-refresh approach:
- **Soft re-fetch**: Zustand stores poll every 60s and re-fetch if stale. Cache TTL is **time-aware** via `getJiraCacheTtl()` in `JIRA_SHARED.ts`: **20 min during business hours (6 AM–8 PM Pacific)**, **60 min off-hours**. Data updates without page flicker.
- **Hard page reload**: Full `window.location.reload()` on an interval from `getPageReloadInterval()` in `JIRA_SHARED.ts` (2h during business hours, 3h off-hours Pacific) to ensure clean state, clear memory leaks, and pick up deployed code changes. Via `usePageAutoRefresh` hook.

### Analytics dashboards (Dev Corner, Trevor)

Data flow:
```
JQL constants → Zustand store (fetch + cache) → analytics builder → chart data mapper → chart component
```

**Stores** (`src/stores/`):
- `operationalJiraStore` — **Shared by Dev Corner One, Two, and Trevor's Screen** (all read from same `OperationalAnalytics`). Fetches 7 parallel JQL queries + batch changelog for transition dates. Builds `OperationalAnalytics` with KPIs, flow data, backlog, devLoadMatrix, agingBuckets, oldest10, throughputRatio, riskScore, agingHotspots, trendVsPrevious14d, **plus** `componentActivity`, `teamActivity`, `inProgressTickets`, `recentlyCompleted`, `requestedTickets`, `byProject`, `byBoardByComponent`. Dev 1 reads throughput/component/team data; Dev 2 reads in-progress/completed/requested/matrix data; Trevor reads NOVA tickets + board-by-component chart.
- `trevorJiraStore` — Legacy store (still exists but no longer used by Trevor's Screen).
- `jiraNovaStore` — NOVA project analytics (open/today/overdue/done).
- `dev1JiraStore` — Dev Corner One extended analytics (NOVA, last 6 months).
- All stores filter with `filterIssuesNovaMinKey` (NOVA-661+) to exclude legacy issues.

**JQL constants** (`src/constants/`):
- `JIRA_SHARED.ts` — `getJiraCacheTtl()` (20 min business hours / 60 min off-hours, Pacific), max results (1000), Tech Owner field ID.
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
