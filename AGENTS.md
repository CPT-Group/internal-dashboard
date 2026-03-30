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

### Jira rework (2026-03-29)

A major Jira restructuring was completed. Going forward, **all new dev work is created as NOVA tickets**. CM and OPRD are legacy — no new tickets will be created in those projects. Existing open CM/OPRD tickets were **not** migrated and will trickle through until resolved; their workflows and JQL remain unchanged. OPRD will be locked down once remaining tickets are cleared (estimated ~1 month).

**What changed:**
- All new tickets from case managers (Alejandra's templates, case update requests, bugs) are now **NOVA** issue types, not CM tasks or OPRD bugs.
- NOVA gained a **Backlog** status and **UAT** status. "In Progress" was **renamed to "In Dev"** across the entire project (all tickets, old and new). Dashboard UI still displays "In Progress" for readability.
- Template-cloned tickets start in **Backlog** (hidden from board). Automation moves them into the sprint when transitioned from Backlog → To Do. Field validation on that transition forces requesters to fill out all required fields.
- **Case Update Requests** and **Bugs** skip Backlog — they are created directly into the active sprint.
- **Bug Sub-Tasks** are a new subtask type for internal bugs found during development. They are tracked on dashboards the same as other subtasks.
- New per-issue-type fields exist (root cause analysis, caused by, avoidance plan, etc. on Bugs). These are available but not yet surfaced on dashboards.
- **Tech Owner** (`customfield_10193`) is being added to all new issue types by the scrum master. Some new types may temporarily lack it; the `isTechOwnerNovaTeam` helper falls back to assignee when Tech Owner is null, so dashboards remain functional.

Three Jira projects feed the dashboards:

- **CM (Case Management)** — **Legacy, winding down.** Case managers created tickets in **"New"** status. Dev work started at **Data Team New** or **Requested**. Then: **Data Team In Progress → Data Team Testing → Data Team Complete** (back to CMs for UAT). Only ~2 open tickets remain. No new CM tasks will be created; replaced by NOVA issue types (see below).
- **OPRD (Operational/Prod Support)** — **Legacy, phasing out.** Bug fixes, operational tasks. Flow: **TO DO** → **Requirement Review** (optional) → **Development** → **Peer Testing** → **QA/QC** → **UAT** → **Resolved**. ~48 open tickets remain (mostly Epics). No new OPRD tickets; bugs are now NOVA Bugs.
- **NOVA (Software Development)** — **Primary project for all new work.** Internal tools, dashboards, and all requests from other departments. Workflow: **Backlog** (template staging, hidden from board) → **To Do** (submitted to devs) → **In Dev** (actively working; Jira status name, displayed as "In Progress" on dashboards) → **Dev Review** → **QA** → **UAT** (back to requesters; category "Done") → **Done**. Legacy issues below NOVA-661 are excluded via client-side `filterIssuesNovaMinKey`.

### NOVA issue types (post-rework)

| Category | Issue Types | Backlog start? | Notes |
|----------|-------------|----------------|-------|
| **Template-cloned** (from Alejandra's deep-clone trees) | Create Database Request, Create Static Website, Create Interactive Website, Create Weekly Report Request, Cancel Weekly Report, NCOA/ACS Request, Create Website Testing - Internal, Create Website Testing - Counsel/External User, Post Order to Website, Downloader Request, Reset Test Users and Import Web Data, Website Tagging, DD Token, Purchase Website URL | Yes — Backlog → To Do | Automation moves to sprint on Backlog→To Do transition. Field validation enforces required fields per type. |
| **Direct-to-sprint** | Case Update Request, Bug | No — created in sprint | Already have required info at creation time. |
| **Subtasks** | Sub-task, Bug Sub-Task | No | Bug Sub-Task is new; used for internal bugs found during dev. Tracked same as other subtasks on dashboards. |
| **Dev-originated** | Story, Task, Epic, Research, Initiative | No | Created by NOVA team for internal work. Epic and Initiative are excluded from most JQL. |

### Status definitions for analytics

| Concept | OPRD | CM | NOVA |
|---------|------|-----|------|
| **Backlog (hidden)** | — | New | Backlog |
| **Requested / not started** | TO DO, Requirement Review | DATA TEAM NEW, REQUESTED | TO DO |
| **Actively working** | Development | Data Team In Progress | In Dev |
| **Dev complete / testing** | Peer Testing, QA/QC | Data Team Testing | Dev Review, QA |
| **Back to requesters** | UAT | Data Team Complete | UAT |
| **Done** | Resolved | Request Complete | Done |

These status mappings drive `isRequestedNotStarted()` and `DEV_RESPONSIBLE_STATUSES` in `operationalAnalytics.ts`.

**Important status notes:**
- Jira status is **"In Dev"**; dashboard UI displays **"In Progress"** for readability. Code must match on `'In Dev'` for NOVA status-name logic but can display "In Progress".
- NOVA **Backlog** has `statusCategory: "To Do"` (`key: "new"`). It is excluded from the board by the `sprint in openSprints()` JQL filter (Backlog tickets aren't in a sprint). It is NOT in `REQUESTED_STATUSES` because Backlog items haven't been submitted to the team.
- NOVA **UAT** has `statusCategory: "Done"` (`key: "done"`), so `statusCategory != Done` queries naturally exclude it.

### JQL scoping rules

All operational JQL (Dev Corner dashboards) mirrors the "Case Management Data Team Board" filter (V.3). The board filter JQL lives in `src/constants/JIRA_OPERATIONAL.ts`.

- **CM**: `status != New`, `statusCategory != Done`, component IN dev-relevant list (Interactive Website, Case Database, NCOA/ACS, Static Website, Web Database, Downloader, Weekly Reports, SCP, Shut Down Service, Data Analysis, Docket Update, Database Migration, Website). No Epics.
- **OPRD**: Two clauses OR'd: (1) `labels IN ("linked-to-CM")` no Epics, (2) `status != New`, `statusCategory != Done`, same component list, no Epics.
- **NOVA**: `assignee IN (NOVA_TEAM)`, `sprint in openSprints()`, `statusCategory != Done`. Only shows team members' tickets in active sprints — not the entire project backlog. The `sprint` filter naturally excludes Backlog items.

Time-based queries (created/resolved today/14d) use the same scoped filter so flow data reflects dev work only, not all project activity.

### Future: "landed on team" tracking for NOVA Backlog

NOVA "landed on team" now mirrors CM/OPRD's transition-based approach (`NOVA_LANDED` / `NOVA_LANDED_RANGE` in `JIRA_OPERATIONAL.ts`). Two paths:
1. **Direct-to-sprint** (Bug, Case Update Request, dev-originated): `created >= date AND status != Backlog` — these land immediately at creation.
2. **Template-cloned** (sat in Backlog): `status changed FROM "Backlog" AFTER date` — the transition date is when work landed, not the created date.

Updated 2026-03-30 — previously used bare `created >= date` which inflated counts by ~23 Backlog template tickets per day. The `sprint in openSprints()` filter on the board query also prevents Backlog items from appearing in the "open" count.

### Tech Owner vs Assignee

Jira custom field `customfield_10193` (**Tech Owner**) identifies the developer who actually does the work. The standard **assignee** changes throughout the ticket lifecycle — devs are assigned while in progress, but when they finish they reassign to the CM for UAT/approval. At resolution time the assignee is typically the CM, **not** the dev who built it.

**Rules for analytics attribution:**
- **Recently Completed, Closed Today, Avg Close Time, Throughput, Flow chart (resolved side), Trend comparisons** — always use **Tech Owner** (`customfield_10193`). Filter to NOVA team tech owners so metrics only count dev-team work.
- **In-Progress (carousel cards)** — include when **Tech Owner** (or assignee if Tech Owner unset) resolves to a **NOVA** account (`isTechOwnerNovaTeam`), so queue-only CM assignees do not appear without NOVA ownership.
- **Team Activity, Dev Load Matrix** — use **assignee** (dev is assigned while actively working); matrix already restricts columns to NOVA assignees.
- **Requested / Not Started** — only issues where **`isTechOwnerNovaTeam`** is true (explicit Tech Owner must be NOVA when set; if Tech Owner is empty, assignee must be NOVA). Dev Corner Two still displays **Tech Owner** and **Assignee** columns so viewers see intended dev vs current queue assignee.
- **Backlog by assignee, backlog by component, due-date buckets, component activity, oldest open, aging hotspots, board×component** — count only issues matching **`isTechOwnerNovaTeam`** so TV aggregates stay NOVA-attributed (same helper as Tech Owner resolution: explicit field, else assignee).
- **Landed Today, Net Today** — both filtered by **`isTechOwnerNovaTeam`**. Tickets assigned to non-team members or unassigned with no tech owner do not count toward landed or net.
- **Limbo** — active tickets on the board where **`!isTechOwnerNovaTeam`**: unassigned with no tech owner, or assigned to someone outside the NOVA team. `kpis.limboCount` + `limboTickets: LimboTicket[]` on `OperationalAnalytics`. Dev Corner One KPI strip shows "Limbo" (replaced "Open"). `LimboTicketsTable` component in `src/components/ui/` (not mounted yet).

**NOVA Components** (`customfield_10754`): On NOVA project issues, this field (e.g. ZION, Legacy/Other) is used for Dev Load matrix bucketing and component text in Dev 2 tables when set; if empty, behavior falls back to standard Jira **components** or “No component”. CM/OPRD continue to use standard components only.

**Standard Jira components on NOVA project:** Case Database, Docket Update, Downloader, Interactive Website, NCOA/ACS, Shut Down Service, Static Website, Web Database, Weekly Reports. These overlap heavily with CM/OPRD components. New template-cloned tickets typically have standard Jira components set; older dev-originated tickets (Stories, Tasks) often use only `customfield_10754` or have no component.

The field is fetched as part of `DEFAULT_JIRA_FIELDS` in `jiraService.ts` and typed on `JiraIssueFields` as `customfield_10193: JiraUser | null`. Helpers `getTechOwnerName()`, `getTechOwnerAccountId()`, and `isTechOwnerNovaTeam()` in `operationalAnalytics.ts` centralize access.

### Bug fields (post-rework)

NOVA Bugs now have structured root-cause fields (not yet surfaced on dashboards):

| Custom field | Label | Notes |
|---|---|---|
| `customfield_10197` | Root Cause Analysis | Free text |
| `customfield_10826` | Root Cause Category | Dropdown |
| `customfield_10969` | Bug Introduced By | User picker |
| `customfield_10970` | Bug Introduced Date | Date |
| `customfield_10968` | Avoidance Plan | Free text |
| `customfield_10789` | Actual Results | Free text |
| `customfield_10790` | Expected Results | Free text |
| `customfield_10791` | Frequency | Dropdown/text |
| `customfield_10792` | Stage Found | Dropdown/text |
| `customfield_10793` | User Impact | Dropdown/text |

These are available for future dashboard features (e.g. root-cause trends, bug quality metrics).

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
- **Styles**: `src/styles/` — `variables.scss`, `base.scss`, `utilities.scss`, `themes/*.scss`, `primereact-overrides.scss`; orchestration in `src/app/main.scss`. Theme is driven by `data-theme` on `<html>` and theme variables; avoid inline styles for theme-driven UI when possible. **ProgressSpinner** stroke uses `--progress-spinner-color` (see `primereact-overrides.scss`; Prime class names `p-progress-spinner-*`).

## TV routes and dashboards

- **Router**: `src/components/pages/TVDashboard/TVDashboard.tsx` — by `roomName`: `dev-corner-one` → `DevCornerOneDashboard`; `dev-corner-two` → `DevCornerTwoDashboard`; `trevor` → `TrevorDashboard`; `conference-room` → `ConferenceRoomDashboard`; `jackie` → `JackiesOfficeDashboard`; `julie` → `JuliesOfficeDashboard`; `github-activity` → `GithubActivityDashboard`. Route slugs match the dashboard/person name.

### GitHub webhooks (receiver + TV)

- **GitHub “Payload URL”** must be your deployed app: **`https://<host>/api/webhooks/github`** — not a Teams Incoming Webhook URL. GitHub sends `POST` with `X-GitHub-Event`, `X-GitHub-Delivery`, and (if you set a secret) `X-Hub-Signature-256`. Teams webhooks expect different JSON; use Teams only as an optional **mirror** after our route processes the event.
- **Env**: `GITHUB_WEBHOOK_SECRET` — same value as GitHub’s webhook secret (HMAC SHA256 verification). **`GITHUB_WEBHOOK_CPT_GROUP`** — optional Microsoft Teams Incoming Webhook URL; we POST a short `{ "text": "..." }` line per delivery (failures do not fail the webhook).
- **Cache**: in-memory ring buffer (`GITHUB_WEBHOOK_CACHE_MAX_EVENTS`, age prune in `src/lib/githubWebhookCache.ts`). On serverless, cache is **per instance** and resets on cold starts — fine for a TV feed of recent activity.
- **TV** `/tv/github-activity`: carousel **30s × 3 slides + 120s** on the feed slide; polls **`GET /api/webhooks/github`** every **`GITHUB_ACTIVITY_POLL_INTERVAL_MS`** (60s). Same hard page reload as other TVs via `usePageAutoRefresh` + `getPageReloadInterval()`.

### GitHub Actions — CD deploy status (Dev Corner Two)

- **Env**: **`GITHUB_DEPLOY_READ_TOKEN`** — Personal Access Token (server only; never `NEXT_PUBLIC_*`). Needs **`actions:read`** on the monitored repos (and **`repo`** if they are private). Used by **`GET /api/github/deploy-status`**, which calls the GitHub REST API for each CD workflow listed in **`GITHUB_DEPLOY_WORKFLOW_MONITORS`** (`src/constants/GITHUB_DEPLOY_MONITORS.ts`).
- **Dev Corner Two** GitHub slide (`GithubDeployStatusSlide`): **`MeterGroup`** summary strip (idle OK / running / attention; shimmer + opacity pulse on `.p-metergroup-meter-container::after`, respects `prefers-reduced-motion`), reusable **`GithubDeployRepoCards`** — 2×2 **PrimeReact Card** grid (equal-height rows filling the left column) for the four main deploy pipelines (Azure Functions API, internal tools SWA, NuGet publish, EF migrations): each card shows **owner/repo**, **run id**, **branch**, workflow title (multi-line), **started / finished or elapsed** timestamps, **duration**, and GitHub workflow id; and right-side **Timeline** of recent runs across monitored repos. **Temporary (2026-03):** the left-column **DataView** “Recent actions” feed is removed; restore from the comment in `GithubDeployStatusSlide.tsx` if needed. Cards use **Tag** status, indeterminate **ProgressBar** when a run is active (track/fill: **`--github-deploy-progressbar-track-bg`** / **`--github-deploy-progressbar-fill`** in `variables.scss` + theme files), compact padding for TV, left-border health cues (green/yellow/red), and link to the run. Timeline/status spacing is tuned with an opposite-column status label. Timeline uses **`useAutoScroll`**. API includes `recentRuns` per monitored workflow so history widgets can render without extra GitHub calls. Repo color coding is theme-driven via `--github-repo-*` tokens in `variables.scss` + theme overrides (dark-synth/dark/light/ms-access). Helpers in **`githubDeployDisplay.ts`**. Polls every **`GITHUB_ACTIVITY_POLL_INTERVAL_MS`** (60s). Not the same as the webhook delivery feed on `/tv/github-activity`. **Timeline typography** uses **`--content-text-size`** (global TV/card scale) and **`--github-deploy-timeline-*`** derived from it in `variables.scss`. **`--github-deploy-timeline-meta-color`** tints only the **branch · time** line under the run title (neon pink on **dark-synth**; per-theme elsewhere). The **left column** status labels (SUCCESS, IN PROGRESS, etc.) use **semantic colors** (green / yellow / red / orange) via `deployTimelineOppositeKind()` — not the meta pink. **Repo cards**: header status **Tag** has subtle pulse/glow (faster pulse on failure); footer **ticker** replaces the Open run button for TV; top **MeterGroup** shimmer is slow for readability.

### Dev Corner physical layout and dashboard philosophy

Dev Corner One and Two are TVs **side-by-side** in the 2nd-floor office, near the entrance and break room. Other departments walk by daily.

- **Dev Corner One (LEFT TV)** — **Developer-focused**. Closest to the dev desks. Single-view layout:
  - KPI strip: **Limbo** (unattributed active tickets), Landed Today, Closed Today, Net, Avg Close Time, Throughput Ratio.
  - Middle left: **Work Hours Today** — horizontal bar chart showing hours logged today (Pacific time) per core dev (Kyle, Roy, James). Uses `useWorkHoursToday` hook (10-min poll). Data from Jira worklog API via `/api/jira/worklogs-today`.
  - Middle right: Component Activity table (per-component: open, today, this week).
  - Bottom: NOVA Team Activity panel (4 dev cards with in-progress ticket chips).
  - Scoped to NOVA team; component `ComponentActivityPanel`, `TeamActivityPanel`, `ThroughputPanel`.
- **Dev Corner Two (RIGHT TV)** — **Company-facing**. Visible to non-dev employees. Carousel slides and dwell times are configured in **`devCornerTwoSlides.config.ts`**: each slide has **`enabled: true | false`** and **`durationMs`** (e.g. **25s** for Jira slides, **300s** for GitHub). Only enabled slides are mounted and rotated; order is fixed in that file. **`DEV_CORNER_TWO_FIXED_SLIDE_INDEX`** pins a **0-based index among enabled slides only** (e.g. `0` when GitHub is the sole enabled slide); `null` = auto-advance.
  - **In-Progress** ticket cards (card grid with key, summary, status, assignee, age); keys starting with `NOVA-` use the same nova accent styling as Dev 1 chips.
  - **Recently Completed** table (last 7 days, **Completed by** = Tech Owner, filtered to NOVA team devs); `NOVA-` rows highlighted.
  - **Requested** — Not Yet Started table (**Tech owner** + **Assignee**); `NOVA-` rows highlighted.
  - **Completions by developer** (`CompletedByDevSlide`): per NOVA team member, tickets completed **today** and **earlier this week** (Mon–Fri window through today, from `resolvedLast14`; excludes today’s keys in the “earlier” list). Developer name + Today/Week header row is **sticky** within the slide scroll.
  - **GitHub — CD deploy status** (`GithubDeployStatusSlide`): **`GET /api/github/deploy-status`** (Actions API + `GITHUB_DEPLOY_READ_TOKEN`).
  - **Not yet in `devCornerTwoSlides.config`**: **Today** close times by component (`TodayComponentVelocitySlide`); **Developer Load Matrix** (`DevLoadMatrixSlide`) — add entries + render cases in `DevCornerTwoDashboard.tsx` when restoring.
  - KPI strip: In Progress, Completed (7d), Requested, Open (Prod), Open (NOVA). **No total "Open"** — that's on Dev 1 (non-redundancy rule). Prod = CM + OPRD.
  - Components in repo (carousel subset active): `InProgressCardsSlide`, `RecentlyCompletedSlide`, `RequestedTicketsSlide`, `CompletedByDevSlide`, `GithubDeployStatusSlide`; plus **`TodayComponentVelocitySlide`**, **`DevLoadMatrixSlide`** when re-added.

- **Trevor's Screen** — **NOVA-focused, mobile-friendly**. Single-view layout:
  - KPI strip: NOVA Active, In Progress (matches Jira "In Dev"), To Do, Review/QA, Total Open.
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
- `LOADING_UI.ts` — `LOADING_NOVA_DATA_PLEASE_WAIT` for operational Jira loading spinners (Dev Corner One/Two, Trevor, Operational Jira, Work Hours Today panel).

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

- **Samsung TV CSS compatibility**: TV dashboards run on Samsung Tizen browsers (older Chromium/WebKit) that do **not** support `color-mix()`. When using `color-mix()` in SCSS, always add a hardcoded `rgba()` fallback on the line **before** the `color-mix` line. Old browsers use the fallback; modern browsers override with the theme-aware `color-mix`. Example: `background: rgba(239, 68, 68, 0.6);` then `background: color-mix(in srgb, var(--red-500) 60%, var(--surface-card));`. For `color-mix(X N%, transparent)`, the fallback is `rgba(R, G, B, N/100)` with the token's approximate RGB.
- **Theme and global styles**: Do **not** change theme, color, or global styles unless the user explicitly asks for it.
- **Changelog**: After every completed task, update `CHANGELOG.md` under `[Unreleased]` (Keep a Changelog format; use Added / Changed / Fixed etc. as appropriate).
- **Components**: Prefer functional components and clear, focused components; reuse shared UI from `src/components/ui/` where it fits. For **charts**: name by purpose, not by dashboard; accept only typed data props; put types in `src/types/charts/`, mappers in `src/utils/chartDataMappers.ts`; pages own Card/Panel and layout.
- **Types (ESLint + strict TS)**: Keep TypeScript strict; use proper types for props and store state. **Never use `any`.** Do **not** use `unknown` as a lazy stand-in — use concrete types, **generics**, **typed callback parameters** where library defaults are loose (e.g. PrimeReact row props), discriminated unions, and `satisfies` where helpful. The only acceptable `unknown` is at **untrusted boundaries** (raw JSON, webhook payloads) with **immediate narrowing** (guards, schemas); do not let `unknown` flow through app logic. Repo ESLint: `@typescript-eslint/no-explicit-any` (**error**) and `no-unsafe-*` — run **`npm run lint`** and **`npm run build`** before finishing work.
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
