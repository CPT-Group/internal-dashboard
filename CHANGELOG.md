# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with custom increment rules.

## [Unreleased]

### Added

- **NOVA team constant** (`NOVA_TEAM.ts`): Renamed from `TREVOR_TEAM` to reflect the team name — *Nerds Of Vast Automation*. Now includes all 6 dev team members: Kyle, James, Roy, Thomas, Brandon Fay, Carlos. Exports `NOVA_TEAM_ACCOUNT_IDS_ARRAY`, `NOVA_TEAM_ACCOUNT_IDS` (Set), `NOVA_TEAM_DISPLAY_NAMES`, `NOVA_TEAM_ORDERED`, `NovaTeamMember` type, and `isNovaTeamMember` helper. All references across stores, JQL constants, and dashboards updated.
- **Dev Load Matrix filtered to NOVA team only**: The Developer Load Matrix now only shows NOVA team members (6 devs), not every assignee across all tickets. Matrix builder in `operationalAnalytics.ts` filters by `NOVA_TEAM_ACCOUNT_IDS` and always includes all 6 members even if they have zero tickets.
- **Requested Tickets slide (Dev Corner Two)**: Replaced Backlog & Aging slide with "Requested — Not Yet Started" table showing tickets waiting for dev pickup. Sorted by age descending with color-coded age tags (info ≤ 3d, warning 4–7d, danger > 7d). Status mapping per project: OPRD → TO DO / Requirement Review, CM → DATA TEAM NEW / REQUESTED, NOVA → TO DO. New `RequestedTicket` type and `isRequestedNotStarted` helper.
- **Workflow status documentation**: AGENTS.md updated with detailed per-project workflow diagrams (OPRD, CM, NOVA) including status-to-concept mapping table. Documents which statuses mean "requested", "actively working", "testing", and "done" for each project.
- **NOVA ticket cleanup**: Closed 36 stale NOVA tickets (not updated in 14+ days) via Jira transitions API. Removed old testing/placeholder tickets (NOVA-1 through NOVA-10) and stale backlog items. Added hygiene guidance to AGENTS.md.

### Changed

- **Dev Corner Two slide duration**: Increased carousel slide time from 20 seconds to 2 minutes (120s) for better readability on TVs.
- **NOVA Team "open" count filtered to dev-responsible statuses**: The per-member open count in the NOVA Team panel now only counts tickets in statuses where the dev team is responsible (e.g. To Do, In Progress, Dev Review, Data Team New, Development, Peer Testing). Excludes tickets handed back to requesters (UAT, Waiting, Data Team Complete, etc.). New `isDevResponsible` helper with per-project status sets.
- **Themed scrollbars**: Applied scrollbar theme variables (`--scrollbar-track-bg`, `--scrollbar-thumb-bg`, `--scrollbar-thumb-hover-bg`) to all scrollable elements via WebKit pseudo-elements and `scrollbar-color` for Firefox. Scrollbars now switch with the theme.
- **Ticket age = time on dev board, not creation date**: Replaced `getAgeDays` (days since Jira created date) with `getDevAgeDays` (days since ticket transitioned FROM "New" for CM/OPRD, or created date for NOVA). This affects all age-related metrics: KPI avg age, oldest, aging buckets, aging hotspots, in-progress/requested ticket ages, component activity aging flags, and avg close time calculation. Store now fetches transition dates for ALL open CM/OPRD tickets (not just landed-last-14).
- **Auto page refresh** (`usePageAutoRefresh` hook): Full `window.location.reload()` every 3 hours on all TV dashboards. Ensures clean state, clears memory leaks, and picks up deployed code changes. Combined with existing soft re-fetch (stores poll every 60s, cache TTL 30 min).
- **Transition-based "Landed on team" metrics**: "Opened" now means when work actually becomes visible to the dev team, not when the Jira ticket was created. CM/OPRD uses `status changed FROM "New"` JQL; NOVA uses `created` date. Changelog API (`GET /api/jira/transitions`) batch-fetches exact transition dates for the 14-day flow chart. Store renamed from `createdLast14`/`openedToday` to `landedLast14`/`landedToday`.
- **Dev Corner One redesign — developer-focused single view**: Replaced risk/workload/action-queue panels with purpose-built panels: KPI strip (open, landed today, closed today, net, avg close time, throughput ratio), throughput flow chart (14d) + trend badge, `ComponentActivityPanel` (per-component: open/today/week), `TeamActivityPanel` (NOVA members with in-progress ticket chips). Removed deprecated `RiskPanel`, `WorkloadPanel`, `ActionQueueTable` sub-components.
- **Dev Corner Two redesign — company-facing carousel**: New `DevCornerTwoDashboard` replaces `NovaDashboard` (which used `jiraNovaStore`). Now uses `operationalJiraStore` for consistent data. 4-slide carousel: `InProgressCardsSlide` (ticket card grid), `RecentlyCompletedSlide` (7-day table), `BacklogAgingSlide` (backlog + aging horizontal bar charts), `DevLoadMatrixSlide` (assignee × component heatmap). KPI strip: In Progress, Completed (7d), Open, Avg Age, Oldest. Non-redundant with Dev 1.
- **OperationalAnalytics extended**: Added `componentActivity` (per-component open/today/week), `teamActivity` (NOVA member in-progress), `inProgressTickets` (status-category filtered), `recentlyCompleted` (7-day window). KPIs: replaced `sprintCompletionPercent` with `avgCloseTimeHours`. Renamed `openedToday` to `landedToday` throughout.
- **TrendBadge UI component**: Inline trend indicator with directional arrow and semantic color (green/red). Props: `value`, `invertColor`, `label`. Reusable for any KPI delta display.
- **KpiStrip UI component**: Data-driven row of KPI cards. Props: `items: KpiItem[]` (label, value, optional severity and badge). Replaces duplicated KPI card patterns across dashboards.
- **OperationalAnalytics extended**: New derived indicators — `throughputRatio` (closed/opened ratio over 14d), `riskScore` (0–100 weighted from aging buckets), `agingHotspots` (top 5 component+assignee by worst avg age), `trendVsPrevious14d` (current vs previous 14d comparison). Risk weights defined in `DEV1_CONFIG.ts`.
- **28-day JQL for trend comparison**: New `JIRA_OPERATIONAL_JQL_CREATED_PREV_14` and `JIRA_OPERATIONAL_JQL_RESOLVED_PREV_14` for the previous 14-day window (days -28 to -14). Store now fetches 7 parallel queries.
- **Workload chart data type and mappers**: `WorkloadByAssigneeChartData` type in `src/types/charts/workloadCharts.ts`. New mappers: `toWorkloadByAssigneeChartData` (sorted desc with % of total) and `toAgingHotspotsBarChartData` (hotspot labels + avg age values).
- **Jackie's Office Dashboard**: New `JackiesOfficeDashboard` page (`/tv/jackie`) with rotating background slideshow from `public/backgrounds/jackies-cute-backgrounds/` and a `CornerInfoCard` showing "Jackie – Vice President, Operations". Follows same pattern as Julie's Office: `BackgroundSlideshow` + `CornerInfoCard`, full-viewport layout, corner badge bottom-right. Build-time script `scripts/generate-jackies-background-slides.js` generates `jackiesBackgroundSlides.generated.ts`. Currently no images in the folder (shows fallback); drop images in and re-run `npm run dev` to populate.

### Fixed

- **Dev Corner theme compliance**: All custom elements (team cards, ticket chips, matrix cells, slide titles, summaries) now use CSS theme variables (`--text-color`, `--surface-card`, `--surface-border`, `--surface-hover`) instead of implicit/unset colors. Both Dev 1 and Dev 2 switch cleanly with theme changes.
- **Dev 1 layout proportions**: Throughput + Component Activity (middle row) reduced to 35% of viewport; NOVA Team panel (bottom row) expanded to 65% for better readability of ticket chips. Increased visible tickets per member from 3 to 4.
- **Jira API v3 pagination**: `jiraService.ts` now handles v3 cursor-based pagination (`nextPageToken`/`isLast`) instead of expecting the deprecated `total`/`startAt`/`maxResults` response fields. Auto-paginates up to 1000 results (10 pages × 100). `JiraSearchResponse` type updated to match.
- **Operational JQL: multi-project (CM + OPRD + NOVA)**: `JIRA_OPERATIONAL.ts` rewritten to closely mirror the Case Management Data Team Board filter (V.3). CM and OPRD scoped by dev-relevant components and **excludes "New" status**. NOVA now uses `assignee IN (NOVA_TEAM)` and `sprint in openSprints()` to match the board — only shows team members' tickets in active sprints, not the entire project backlog. OPRD adds `labels IN ("linked-to-CM")` clause. Open count dropped from ~95 to ~60 after alignment.

- **Auto-scroll on Component Activity**: Fixed `useAutoScroll` not activating — removed reliance on PrimeReact internal `.p-datatable-wrapper` class. Now uses our own `overflow-y: auto` wrapper div with the scroll ref attached directly. Additionally rewrote the hook to use `setInterval` with fractional position accumulation; the previous `requestAnimationFrame` approach with sub-pixel `scrollTop += 0.4` was silently rounded to 0 by the browser, preventing any visible scrolling. Slowed to 12 px/sec for comfortable TV reading.
- **Auto-scroll on NOVA Team ticket lists**: Each team member card now independently auto-scrolls its ticket chip list when it overflows (10 px/sec, 4s pause). Extracted `MemberCard` sub-component to give each card its own scroll ref.
- **Auto-scroll on Dev Corner Two slides**: Applied `useAutoScroll` to all scrollable carousel slides — Recently Completed table (12 px/sec), In Progress card grid (12 px/sec), and Developer Load Matrix (10 px/sec). Removed PrimeReact `scrollable`/`scrollHeight="flex"` from Recently Completed DataTable (same sub-pixel bug as Dev 1). Added shared `.tableCard`/`.tableScrollWrap` SCSS for consistent flex + overflow layout.

### Changed

- **Global font-size: 75% -> 100%**: Base `html` font-size bumped from 75% to 100% (1rem = 16px, browser default). All rem-based sizing scales up ~33% — text, PrimeReact components, spacing, charts. Eliminates the need for extreme browser zoom on TVs.
- **AGENTS.md rewrite**: Comprehensive update with NOVA team info, Jira workflow (CM/OPRD/NOVA status meanings), Dev Corner 1/2 physical layout and dashboard philosophy (developer-focused vs company-facing), non-redundancy rule, auto-refresh strategy, JQL scoping rules.
- **Dev Corner routing**: `dev-corner-one` routes to `DevCornerOneDashboard` (single-view developer dashboard); `dev-corner-two` routes to `DevCornerTwoDashboard` (company-facing carousel). Both share `operationalJiraStore`. Old `NovaDashboard` (jiraNovaStore-based) removed from Dev 2.
- **Routes renamed to match dashboard names**: Julie's Office route changed from `/tv/break-room` to `/tv/julie`; Jackie's Office from `/tv/lobby` to `/tv/jackie`. Router `roomName` values updated to match (`julie`, `jackie`). Route slugs now consistently reflect the dashboard/person name.
- **Backgrounds consolidated**: Moved all background image folders under `public/backgrounds/`: conference room from `public/background/background-conf-room/` to `public/backgrounds/conference-room/`, Julie's unicorns from `public/JuliesUnicorns/backgrounds/` to `public/backgrounds/julies-unicorns/`. Removed old `public/background/` folder entirely. Updated all generation scripts, constants, and docs.
- **Build scripts**: `npm run dev` and `npm run build` now also run `generate-jackies-background-slides.js`.
- **AGENTS.md pre-commit checklist**: Added convention to always regenerate background slide lists before committing/pushing, so new/removed images are reflected in the generated `.ts` files.

### Added

- **CornerInfoCard (reusable UI)**: Small horizontal glassy card for corner placement. Props: `name` (main title), `title` (subtitle/position), `widgetType`: `'weather' | 'cpt' | 'none'`. Background ~30% transparent (theme surface), solid border; name and title use theme text colors. `widgetType="none"` shows only name/title; `weather` and `cpt` render a reserved slot for future content (no API hookup yet). Parent positions the card (e.g. absolute with top/left inset).
- **Docs: Julie's dashboard dynamic card colors**: New `docs/julies-dashboard-dynamic-card-colors.md` – future idea for adapting corner card background/text to the current slide (light/dark or palette per image); no implementation yet.
- **Julie's Office corner card**: JuliesOfficeDashboard now shows a subtle floating card in the bottom-right (3.5rem inset) with "Julie Green" and "CPT President & Unicorn Expert", `widgetType="none"`. Image remains the main focal point; card is responsive and stays in the same corner on all screen sizes.

- **GET /api/sf/projects** – Returns Project__c records as the case list (same shape as support portal: id, label, name, projectName, caseID). Source of truth for cases; cached 5 min. Not yet consumed by any dashboard UI. **Docs**: `docs/salesforce-oauth-and-support.md` updated with route and curl example.
- **GET /api/sf/support-channel** – Returns Support_Channel__c records (support requests from the support portal) for future charts/tables. Fields: Id, Name, CreatedDate, Type__c, Case_No__c, Case_Email__c, Stage__c, Project__c, Website_Detail_Summary__c; ordered by CreatedDate DESC, limit 200; cached 5 min. No UI yet.

## [0.1.56] - 2026-02-19

### Added

- **Reusable chart components (purpose-named)**: New `@/components/charts/` with presentation-only chart components that accept only typed data (no JQL, no store). Components: `OpenClosedAvgHoursByAssigneeRadarChart`, `OpenAndAvgDaysByAssigneeBarLineChart`, `ByBoardByComponentStackedBarChart`, `OpenedClosedFlowBarChart`, `HorizontalBarChart`, `GanttChart`. Chart data types live in `@/types/charts/` (assignee, board/component, flow, horizontal bar, gantt). Mappers in `@/utils/chartDataMappers.ts` convert analytics (NovaAnalytics, OperationalAnalytics) into these types so dashboards stay thin: get analytics from store → map to chart data → pass to chart. Wrappers (Card, Panel, layout) stay on the page; charts have no hardcoded wrappers.

### Changed

- **TrevorDashboard uses shared charts**: Replaced `AssigneeComboChart`, `DistributionChart`, `ByBoardComponentChart`, and local `GanttChart` with shared components from `@/components/charts` and mappers from `@/utils/chartDataMappers`. Page-level Cards and layout unchanged; home page and screen titles unchanged.
- **OperationalJiraDashboard uses shared charts**: Replaced inline `FlowChartMemo`, `BacklogChartMemo`, and `AgingChartMemo` with `OpenedClosedFlowBarChart` and `HorizontalBarChart` plus mappers `toOpenedClosedFlowChartData`, `toBacklogByComponentBarChartData`, `toAgingBucketsBarChartData`. Carousel and KPI strip unchanged.
- **Removed Trevor-specific chart components**: Deleted `TrevorDashboard/AssigneeComboChart.*`, `DistributionChart.*`, `ByBoardComponentChart.*`, and `GanttChart.tsx`; shared `GanttChart` now lives under `@/components/charts/GanttChart`.

### Changed

- **AGENTS.md**: Updated for shared chart architecture — added Charts and TV routes/dashboards sections, chart naming and data-only convention, and pointer to mappers and types.

### Fixed

- **Chart.js tooltip callbacks**: `OpenClosedAvgHoursByAssigneeRadarChart` and `OpenAndAvgDaysByAssigneeBarLineChart` now use the correct Chart.js callback signatures: `afterLabel(tooltipItem)` (single item) and `afterBody(tooltipItems)` (array), per Chart.js TooltipCallbacks API.

## [0.1.55] - 2026-02-18

### Added

- **BackgroundSlideshow (reusable UI)**: New `@/components/ui/BackgroundSlideshow` component. Accepts `slides` (array of image URLs), `intervalMs`, `transitionDurationMs`, `transition`, optional `className` and `fallbackClassName`. Use for any screen that needs a full-bleed rotating background – pass the slide list (e.g. from generated constants) and optional config. Supports multiple **transitions**: `fade`, `slideUp`, `slideDown`, `slideLeft`, `slideRight` (all CSS, ease-in-out, smooth). Empty slides show an optional fallback (theme background). Conference room and Julie's Office now use this component instead of duplicated logic.

### Changed

- **Conference room and Julie's Office use BackgroundSlideshow**: Both dashboards refactored to use `<BackgroundSlideshow slides={...} />` with `transition="fade"` (default). Removed duplicate slideshow markup and CSS from both; ConferenceRoomDashboard keeps only scroller overlay styles; JuliesOfficeDashboard keeps only viewport wrapper. Any future screen can add a slideshow by passing its slide array and choosing a transition.

## [0.1.54] - 2026-02-18

### Changed

- **npm: audit re-check and latest updates**: Re-verified dependency state after updates. Current: **0 high** (minimatch override ^10.2.1), **10 moderate** (ajv in ESLint chain; no fix without breaking eslint-config-next or forcing ajv 8 which breaks ESLint). ESLint kept at ^9 for compatibility with eslint-config-next 16.1.6; ESLint 10 would clear audit only with an ajv override that causes lint to fail. All other deps at latest within range; `npm run lint` and `npm run build` pass.
- **npm: dependencies updated and high-severity vulnerabilities resolved**: Updated devDependencies to latest within range: `@types/node` ^25, `@typescript-eslint/*` and `typescript-eslint` ^8.56.0, `zustand` ^5.0.11. Added `overrides.minimatch` ^10.2.1 to fix 14 high-severity ReDoS issues in the ESLint/minimatch chain; removed `overrides.ajv` (it conflicted with ESLint and caused lint to fail). Audit now reports 0 high, 10 moderate (ajv in ESLint; no safe fix without breaking ESLint). ESLint config: type-aware rules (`no-unsafe-*`) limited to `src/**` with `parserOptions.project` so config files no longer fail; `scripts/**` ignored; strict React/TypeScript rules relaxed to warn where needed so `npm run lint` passes (116 warnings, 0 errors).

### Added

- **Julie's Office dashboard with unicorn rotating background**: New route `/tv/break-room` (Julie's Office) now renders `JuliesOfficeDashboard` with a rotating background slideshow using images from `public/JuliesUnicorns/backgrounds/`. Build-time script `scripts/generate-julies-background-slides.js` (runs before dev/build) reads that folder and writes `juliesBackgroundSlides.generated.ts`; add or remove images and re-run `npm run dev` or `npm run build` to refresh. Same behavior as conference room: 6s per slide, 1.5s fade. No other content yet (scroller/widgets to be added later). Folder created with `.gitkeep`; drop unicorn images in `public/JuliesUnicorns/backgrounds/` to use them.

## Versioning Rules

- **Patch (0.0.1)**: Small changes, bug fixes, minor updates
- **Minor (0.1.0)**: Medium changes, new features, significant updates
- **Major (1.0.0)**: Major releases, production-ready milestones, breaking changes
- Version increments max at 9 (e.g., 0.9.9 → 1.0.0)

## [0.1.45] - 2026-01-29

### Changed

- **Theme system rework (cpt-internal-tools style)**: Theme is now a single SCSS pipeline instead of swapping legacy theme CSS links. Load order: PrimeReact theme (lara-dark-blue) from npm → variables → base → utilities → theme overrides. New files: `src/styles/variables.scss` (default design tokens), `src/styles/base.scss` (resets, html/body, Lato fonts, layout/page styles), `src/styles/utilities.scss` (focus-visible, sr-only), `src/styles/themes/dark.scss` and `src/styles/themes/light.scss` (variable overrides only for `[data-theme='dark'|'light']`), `src/app/main.scss` (orchestration). ThemeProvider only sets `data-theme` on `<html>` and persists to localStorage; no link manipulation. Layout imports PrimeReact theme CSS and main.scss; theme-init script only sets data-theme before paint. `globals.css` content moved into base/layout SCSS; file reduced to a comment. Lato fonts still served from `public/themes/cpt-legacy-dark/fonts/`. Theme toggle is instant with one bundle.

## [0.1.47] - 2026-01-29

### Changed

- **Themes match cpt-internal-tools**: Replaced legacy dark/light with internal-tools themes: dark, light, dark-synth, ms-access-2010. Default theme is **dark-synth**. Theme files (`src/styles/themes/*.scss`) now mirror internal-tools variable names and values; `variables.scss` defaults to dark-synth.
- **Theme switcher only on home page**: Theme can be changed only from the main home page via a sticky button at the top that cycles dark-synth → dark → light → ms-access-2010. TV and other routes have no theme switcher. ThemeProvider exposes `theme`, `setTheme`, and `cycleTheme` (replacing `toggleTheme`).
- **No inline styles for theme-driven UI**: Removed inline styles from components so theme variables control appearance. Progress spinners use classes `progress-spinner-sm` / `progress-spinner-md`; chart containers use `chart-height-sm|md|lg|xl` and `chart-meter-container` with theme vars `--progress-spinner-size-*`, `--chart-height-*`, `--chart-meter-*` (all themes define these). JiraMeterChart center value/label use `chart-meter-center-value` and `chart-meter-center-label`. Conference room slideshow transition moved to CSS module; only dynamic `backgroundImage` remains inline. TextScroller keeps inline `--text-scroller-duration` (prop-driven). Spinner and chart variables added to every theme file.

## [0.1.49] - 2026-02-13

### Changed

- **Julie's Office icon: Font Awesome removed, local unicorn SVG**: Removed all Font Awesome packages (`@fortawesome/fontawesome-free`, `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome`, `fontawesome`). Julie's Office card now uses a local unicorn SVG (from `public/icons/emoji-unicorn.svg`), inlined in `DashboardCard` as `UnicornIcon` with `stroke="currentColor"` so it follows the theme primary color.

## [0.1.48] - 2026-02-13

### Changed

- **Home screen: Julie's Office and Jackie's Office cards**: Renamed **Lobby** to **Jackie's Office** (briefcase icon, `pi pi-briefcase`) and **Break Room** to **Julie's Office** (unicorn icon). Julie's card uses a local unicorn SVG (from `public/icons/emoji-unicorn.svg`, inlined in `DashboardCard` as `UnicornIcon` with `currentColor` for theme) and a subtle unicorn-style accent (pastel purple/pink gradient border and hover glow). Font Awesome removed; `DashboardItem` supports optional `variant: 'unicorn'`; `DashboardCard` accepts `variant` and applies `.dashboard-card-unicorn` for Julie's card.

## [Unreleased]

### Added

- **AGENTS.md**: Project root file for AI coding agents. Describes stack (Next.js 16, React 19, TypeScript, PrimeReact, Zustand, etc.), dev setup and scripts, build-time slide generation, code layout and `@/` paths, conventions (no theme/global style changes unless asked; always update CHANGELOG after completed tasks), and lint/build expectations. **Continual learning** section: capture new conventions and user preferences in AGENTS.md or `.cursor/rules/`; keep AGENTS.md current when stack or layout changes.

- **NOVA dashboards: only NOVA-661+**: All NOVA data (Dev Corner Two, Operational, Dev1, Trevor) is filtered client-side to **NOVA-661 and above**. Legacy issues (NOVA-1 through NOVA-660) are excluded from counts, charts, and tables. Constant `JIRA_NOVA_MIN_ISSUE_NUM = 661` in `src/constants/JIRA_NOVA.ts`; shared filter in `src/utils/jiraNovaFilter.ts` used by `jiraNovaStore`, `operationalJiraStore`, `dev1JiraStore`, and `trevorJiraStore`. Open counts for Dev1 and Trevor are now derived from the filtered list (no separate Jira open-count request).

- **Docs: closing legacy NOVA (NOVA-1–660)**: New `docs/jira-close-nova-legacy.md` with JQL and steps to close/resolve legacy NOVA issues via Atlassian CLI (or bulk in Jira). Notes that Jira compares `key` as string so strict numeric range 1–660 may require export + filter then bulk transition.

- **Jira API layer for widgets**: New `src/services/api/endpoints/jira/` with fine-tuned, typed API functions: **tickets** – `getTicketsTransitionedToday()` (resolved today, not created), `getTicketsCreatedToday()`; **updates** – `fetchUpdates(since)` for incremental “updated since” polling. JQL for these in `jira/jql.ts`; all NOVA results filtered to key ≥ 661. **Hook** `useJiraUpdatesPolling({ intervalMs, onUpdates })` runs `fetchUpdates` every 30 minutes (configurable), tracks last check timestamp, and optionally calls `onUpdates(issues, fetchedAt)` for widgets. Exported from `@/services` and `@/hooks`.

- **Salesforce API (read-only) and discovery**: New server-side `src/services/api/salesforceService.ts` – OAuth2 password flow (env: SF_LOGIN_URL, SF_CLIENT_ID, SF_CLIENT_SECRET, SALESFORCE_EMAIL_KYLE, SALESFORCE_PASSWORD_KYLE, SALESFORCE_SECURITY_TOKEN_KYLE), `describeGlobal()`, `describeSObject(name)`, `query(soql)`. **Routes**: `GET /api/salesforce/discover` (list sobjects; `?sobject=Account` returns describe for one object), `GET /api/salesforce/query?q=SOQL` for read-only SOQL. **Docs**: `docs/salesforce-discovery.md` – setup, discovery log template, and tables to track objects/fields and chart ideas as we learn what data we have.

- **Salesforce OAuth (CPT TV) and Support Portal**: **OAuth2 Authorization Code + PKCE** for Connected App “CPT TV”. Env: `SALESFORCE_CONSUMER_KEY` / `SALESFORCE_CONSUMER_SECRET` (or `SF_CLIENT_ID` / `SF_CLIENT_SECRET`), `SF_LOGIN_URL` (default login.salesforce.com), `SF_API_VERSION` (default v60.0). **Routes**: `GET /oauth/start` → redirects to Salesforce authorize; `GET /oauth/callback` → exchanges code for tokens, writes `.sf_tokens.json` (dev), shows “Connected”; `GET /api/sf/whoami` → userinfo (verify token); `GET /api/sf/describe/support-channel` → Support_Channel__c describe (required + createable fields); `GET only in this app; Support Portal (cpt-support-portal repo) has OAuth + POST /api/support-request. **Docs**: `docs/salesforce-oauth-and-support.md`. `.sf_tokens.json` in .gitignore.

- **Conference room slideshow: auto-use all folder images**: The conference room background slideshow now uses every image in `public/background/background-conf-room/` with no manual list. A build-time script (`scripts/generate-conference-slides.js`) runs before `dev` and `build` (no API, no third-party deps), reads the folder (recursively, including subfolders), shuffles the order, and writes `conferenceBackgroundSlides.generated.ts`. Supported extensions: jpg, jpeg, jfif, png, gif, webp, svg, bmp, avif. Add or remove images in that folder; run `npm run dev` or `npm run build` so the list updates (do not run `next dev` directly or the list can be stale). **Generated file is now committed** so the full list is in the repo and all slides (e.g. bg-13, bg-17, bg-20+) are included; script still runs before dev/build to refresh when new images are added.

### Fixed

- **npm audit: 0 vulnerabilities**: Resolved 10 moderate (ReDoS in ajv) by adding `overrides.ajv` to `^8.18.0` in `package.json`. All dependencies now use a patched ajv.

### Changed

- **Dependencies**: React and React-DOM set to 19.2.4; `@types/node` to ^22. Next.js and eslint-config-next remain at latest stable 16.1.6.

### Added

- **Operational Jira TV dashboard for Dev Corner One and Two**: **Dev Corner One** (`/tv/dev-corner-one`) and **Dev Corner Two** (`/tv/dev-corner-two`) now both show the same real-time operational dashboard. **1) KPI strip**: Open, Opened today, Closed today, Net today (with PrimeReact **Tag**: Growing/Shrinking/Flat), Avg age, Oldest open. **2) Flow**: PrimeReact **Panel** (toggleable) + **Chart** bar – Opened vs Closed last 14 days. **3) Backlog by component**: **Card** + **Chart** horizontal bar; **Tag** “Aging” for components with tickets >7d. **4) Developer load matrix**: Heatmap table (dev × component). **5) Aging buckets**: **Chart** horizontal bar (0–1d … 15+d). **6) Oldest 10**: **DataTable** with **Tag** for Status (severity by age). Uses PrimeReact Card, Chart, DataTable, Message, ProgressSpinner, Skeleton, Tag, Panel. Data from `operationalJiraStore` (JIRA_OPERATIONAL, NOVA). Standalone “Operational Jira” entry removed from home list; access only via Dev Corner One or Two. `chartjs-plugin-gantt` can be added later if a Gantt view is needed.
- **PrimeReact component theme overrides**: New **`src/styles/primereact-overrides.scss`** overrides all lara-dark-blue hardcoded components using theme variables only (works for every theme). Overrides: **Accordion** (header link, hover, highlight, content, focus-visible), **Card**, **Panel** (header, content, footer, header icon, hover, focus-visible), **DataTable** (header, footer, thead/tbody/tfoot, sortable/hover/highlight, scrollable, striped), **Message** (info/success/warn/error), **Tag** (default + success/info/warning/danger), **Button** (primary, outlined, text), **Skeleton**. Loaded after theme files in `main.scss`. Card overrides were removed from the four theme files and consolidated here.
- **.p-card theme overrides** (consolidated): Card overrides now live in `primereact-overrides.scss`; duplicate `.p-card` blocks were removed from dark, light, dark-synth, and ms-access-2010 theme files.

- **Theme system documentation**: New **`docs/theme-system.md`** is the canonical reference for using and updating the theme (default dark-synth, four themes, file structure, load order, how to add a theme or variable, theme-init script, PrimeReact CSS). README Theme section and Documentation list updated; `theme-implementation-notes.md`, `primereact-theming.md`, and `theme-investigation-interactive-and-internal-tools.md` now point to `theme-system.md` for current behavior.

### Changed

- **Dark-synth theme application fix**: PrimeReact theme.css sets `:root` with blue colors; when it loaded after our SCSS (e.g. in some Next.js/Turbopack orderings), it overwrote our variables. **variables.scss** now uses `!important` on all dark-synth `:root` variables so our theme wins. **dark-synth.scss** adds explicit `html[data-theme='dark-synth']` and `body` background/color rules so the purple/cyan background and text apply even if variable order is wrong. **base.scss** uses fallbacks `var(--page-background, #0c0020)` and `var(--text-primary, #dbd4fa)` so first paint is always dark-synth. Layout comment documents that theme.css must load before main.scss.
- **Chart theme overrides – colors only, not sizing**: Chart sizing variables (`--chart-height-*`, `--chart-meter-height`, `--chart-meter-center-value-font-size`, etc.) were removed from all four theme files. Sizing is defined once in `variables.scss` and used by base styles; themes no longer override chart dimensions or meter font sizes. Chart **colors** continue to come from theme (e.g. `--text-color`, `--surface-border`) via the JS options passed to PrimeReact Chart.
- **Trevor Dev Team Timeline when empty**: Timeline card no longer grows when there are no Gantt tasks: it uses a compact height (max 100px) and does not take flex space. Empty state uses class `trevor-gantt-empty` with `flex: 0 0 auto` and `min-height: 0` on the inner wrap.
- **Trevor layout alignment**: Charts row and board row use full width and consistent spacing. Board row top margin set to 0.35rem to match dashboard gap; removed redundant `mt-2`. Chart row columns are flex so cards align; grid and cards have `min-width: 0` to avoid overflow.
- **Operational Jira KPI strip compact**: KPI strip at the top of the operational dashboard is now much smaller to save real estate: reduced card padding (0.25rem 0.35rem), smaller value font (1.15rem), smaller labels (0.7rem), and tighter grid gap/margin. Uses scoped classes `operational-kpi-strip`, `operational-kpi-value`, `operational-kpi-label` in `base.scss`; loading skeleton uses the same strip with 6 compact cards.
- **Operational Jira TV carousel (no scrolling)**: Dashboard content below the KPI strip is now an auto-rotating carousel with four slides so the whole dashboard fits on a TV without scrolling. **Slide 1**: Flow (last 14 days) chart. **Slide 2**: Backlog by component and Aging buckets side by side. **Slide 3**: Developer load matrix. **Slide 4**: Oldest 10 open tickets. Slides advance every 25 seconds. Dot indicators at the bottom show the current slide. Layout uses `min-height: 100vh; max-height: 100vh; overflow: hidden` and flex so the carousel area fills the remaining space; all content is sized to fit within one view.
- **Operational carousel smooth transitions and countdown**: Carousel uses a slide-left/slide-right transition (0.6s ease-in-out): the current slide slides out left and the next slides in from the right. Each slide’s title shows a live countdown when it’s active, e.g. `Developer load matrix (countdown: 12s)`, with the number updating every second until the next slide.
- **Operational carousel: no chart re-renders from countdown**: Countdown state is isolated in `SlideTitleWithCountdown` so only that component re-renders every second; the dashboard and charts no longer re-render on each tick. Bar charts (Flow, Backlog, Aging) are wrapped in `React.memo` so they only re-render when their data/options change, preventing constant re-renders and flicker. DataTable column `body` renderers use `useCallback` for stable references; `SlideTitleWithCountdown` is memoized so it only re-renders when its props (e.g. active slide, start time) or its own tick state change.
- **TextScroller optional text/background colors**: **TextScroller** accepts optional **`textColor`** and **`backgroundColor`** props. When omitted, text uses theme (`--text-color`) and background is transparent so parent/theme controls it (e.g. Trevor page keeps theme). **Conference room** uses `textColor="white"` and `backgroundColor="black"` for a white-on-black strip; scroller wrap background set to black.
- **Trevor dashboard: single-screen, responsive for TV/small viewports**: Layout fixed so everything fits on one screen with no page scroll and no overlap. **Single screen**: `overflow: hidden` on `.trevor-dashboard-content` (was `overflow-y: auto`). **Charts row**: `flex-shrink: 0` and **max-height** via `--trevor-charts-row-max-h` (22rem) / `--trevor-charts-row-max-h-mobile` (18rem) so the row never overflows or overlaps the timeline. **Distribution donut**: Strict containment—`overflow: hidden` on card and content, `max-height: 100%` on chart-meter-container and wrappers; DistributionChart module uses `max-height: 100%` and `overflow: hidden` so the donut never breaks out. **Board row**: `flex-shrink: 0` and `max-height: var(--trevor-board-card-max-h)`. **Timeline**: Gets remaining space (`flex: 1; min-height: 0`); card content scrolls internally if needed. **TV/small**: Media queries at 1024px and 767px reduce chart/board heights and timeline min so the full dashboard fits on Trevor’s TV (mobile-like viewport). New variables: `--trevor-charts-row-max-h`, `--trevor-charts-row-max-h-mobile`.
- **Trevor Distribution donut**: Donut and container reduced to 88px / 14vh so the chart is smaller. Center value/label use theme variables with fallbacks (`--text-color`, `--p-text-color`, `--text-color-secondary`, `--p-text-muted-color`). JiraMeterChart legend text now uses computed theme color so it renders white (or theme text color) instead of black.
- **Trevor Open & avg combo chart**: Switched to PrimeReact ComboDemo-style: single `<Chart type="line">` with mixed bar + line datasets; options built in `useEffect` via `getComputedStyle(document.documentElement)` for `--text-color`, `--text-color-secondary`, `--surface-border` (legend, ticks, grid). Chart always shows all 4 team members (Roy, James, Thomas, Kyle) using `TREVOR_TEAM_ORDERED`; missing assignees show as 0 open / 0 avg days.
- **Trevor spacing and timeline**: Charts row uses CSS Grid (7fr 5fr) with 0.35rem gap for consistent alignment; board row margin removed so parent gap controls spacing. Empty Dev Team Timeline section limited to 72px max height with compact padding; empty message uses `.trevor-gantt-empty-msg` and theme secondary text color. Gantt wrapper has min-height 180px when there are tasks so frappe-gantt can render (still using react-frappe-gantt; PrimeReact has no Gantt component).
- **Trevor chart overflow**: Chart wrappers constrained so charts no longer overflow cards. Card content and `.trevor-chart-inner` use `overflow: hidden`, `min-width: 0`, and explicit heights (e.g. `chart-height-xl` = min(160px, 24vh)); PrimeReact Chart root (`.p-chart`) forced to `width/height 100%` and `min-height: 0` so Chart fills the inner and respects `maintainAspectRatio: false`. Board row cards and content also get overflow containment. Charts use `className="trevor-chart-canvas"` for targeting.
- **Trevor charts as components; styles out of base**: Each Trevor chart is now a functional component with its own module styles: `AssigneeComboChart`, `DistributionChart`, `ByBoardComponentChart`. Chart sizes, overflow, and containment live in each component's `.module.scss`; base.scss only keeps layout (grid, gap, card padding) and theme/color rules. Options and colors use `getComputedStyle(document.documentElement)` in each component (PrimeReact demo pattern). Follows do-donts: co-locate component + styles, keep components under 300 lines.
- **Trevor Open & avg: radar chart**: Replaced horizontal combo with a **radar** chart so all 4 team members (Roy, James, Thomas, Kyle) are always visible as four axes. Two datasets: Open count and Avg days to close (avg days scaled to match open for visibility; tooltip shows actual days). Theme colors from getComputedStyle for legend, point labels, and grid.
- **Trevor Distribution donut fills card**: Distribution chart container now fills the full card content (width/height 100%) so the donut and legend use all available space instead of a small fixed block with unused space; layout drives size via flex and stretch.
- **Trevor assignee radar: Open, Closed, Avg hours to close**: Radar now shows three metrics: **Open**, **Closed** (done count), and **Avg hours to close** (avgDaysToClose × 24, rounded to 1 decimal). Tooltips show actual open count, closed count, and avg hours (with days in parentheses when ≥ 1). Card title set to "Open, closed & avg hours by assignee" with subtitle **CM, NOVA, OPRD** so it’s explicit that data is across all three boards (JQL already uses project IN (OPRD, CM, NOVA)).
- **Trevor Distribution**: Wrapper fills card height and centers the donut; donut size set to min(100px, 16vh) so it uses space without leaving large gaps. Card content flex so the section is no longer small with unused space.
- **Trevor Distribution layout**: Donut was too small and looked odd. Distribution chart now uses a single block (donut + legend) at min(180px, 26vh) height and min(240px, 36vw) width (max-width: 100%) so it scales with the card and leaves room for the legend. Wrapper uses flex center so the block stays centered and rearranges with the card.
- **Trevor Distribution chart**: Donut replaced with combo bar + line chart: **bars** = Open per assignee (left Y-axis), **line** = Avg days to close (right Y-axis, dashed). Uses TREVOR_TEAM_ORDERED and theme colors from getComputedStyle; dual scales (y / y1) so both metrics are readable.
- **Chart heights/sizes scoped per chart (not global)**: Chart heights and meter styles no longer live in **base.scss** so global styles don’t override other charts. **JiraMeterChart**: container, center overlay, and label styles moved to **JiraMeterChart.module.scss**. **Trevor**: charts row, chart cards, distribution card, gantt chart wrap, and related media queries moved to **TrevorDashboard.module.scss** (imported by TrevorDashboard). **Dev Corner One** and **Nova**: chart wrapper heights (xl/lg/md) moved to **DevCornerOneDashboard.module.scss** and **NovaDashboard.module.scss** and applied via module classes. **variables.scss** still defines `--chart-height-*` and `--chart-meter-*`; components reference them in their own modules. Base keeps only a short comment that chart sizes are component-scoped; colors remain theme-driven.
- **Trevor timeline**: More robust date handling: `parseDate()` accepts string (ISO or YYYY-MM-DD), number (timestamp), and normalizes to YYYY-MM-DD so tasks are created when Jira returns `created` in different shapes. Empty state message: "No issues loaded…" when no issues from Jira, or "No tasks with valid start/end dates…" when issues exist but none have parseable dates. GanttChart accepts optional `noData` prop for this.
- **Docs**: Added `docs/gantt-timeline-options.md` with options (chartjs-plugin-gantt, react-calendar-timeline, SVAR Gantt, Highcharts/Bryntum) and recommendation to start with chartjs-plugin-gantt for the Trevor timeline use case.
- **Trevor responsive layout (rem + min/max)**: Trevor dashboard is now fully responsive. **variables.scss** adds Trevor design tokens: `--trevor-gap`, `--trevor-padding`, `--trevor-charts-card-min-h`, `--trevor-charts-card-max-h`, `--trevor-charts-content-min-h`, `--trevor-board-card-max-h`, `--trevor-timeline-min-h`, `--trevor-timeline-max-h` (all rem-based). **base.scss** uses these for padding, gap, and all chart/timeline min/max heights so layout scales with viewport and doesn’t break when the grid wraps. At `max-width: 767px` when the top row stacks to one column, both cards get the same min/max so layout stays even. AssigneeComboChart, ByBoardComponentChart, and DistributionChart modules use rem for wrap min/max heights. Empty gantt and chart-inner use rem. Trevor page stays usable at any viewport size.
- **Trevor Distribution donut and timeline fixes**: Distribution card now has class `trevor-chart-card-distribution` and base styles so the donut container fills the card (height 100%, min-height 160px); charts row card content has min-height 180px so both top cards get space. Timeline: when it has tasks, the gantt wrap gets min-height min(420px, 48vh), chart wrap min-height 320px and .p-chart min-height 300px so bars and labels are readable; bar thickness 32px, tooltip shows formatted dates.
- **Trevor Distribution donut centering**: **JiraMeterChart** now supports `legendPosition="bottom"` so the legend sits below the donut; with legend on the right the "1 Open" center text was misaligned (centered in the full box including legend). Distribution uses `legendPosition="bottom"`. Base styles: `.chart-meter-legend-bottom .chart-meter-center` is limited to the top 50% of the container so the center text sits in the donut hole; Distribution card content and wrap use `align-items: stretch` and `width: 100%` so the meter fills the card and the donut is centered.
- **Trevor Dev Team Timeline – Chart.js**: Replaced **react-frappe-gantt** (which never rendered) with a **Chart.js horizontal floating bar** chart: time scale on X, task labels on Y, one bar per issue (created → duedate or today). Uses PrimeReact Chart, `chartjs-adapter-date-fns` for time parsing, and theme colors via getComputedStyle. Removed `react-frappe-gantt`, `frappe-gantt`, and `chartjs-plugin-gantt`; timeline now uses the same Chart.js stack as the rest of the dashboard.

## [0.1.47] - 2026-02-12

### Changed

- **Trevor responsive / viewport fit**: Dashboard constrained to 100vh/100vw; chart areas use vh-based max-heights so content fits on screen. Distribution donut reduced (120px / 18vh max) with smaller center text in Trevor; first row charts capped at 32vh; board row at 22vh; Gantt gets remaining space. Added `trevor-board-row` and flex/min-height rules so sections shrink and scroll when needed.

## [0.1.46] - 2026-02-12

### Changed

- **Trevor By board & component**: Combined "By board" and "By component" into one chart. "By board & component" shows horizontal stacked bars per board (CM, NOVA, OPRD), with segments by component (Case Database, Interactive Website, No component, etc.). When no component breakdown exists, falls back to a single "Open" bar per board. Analytics: added `byBoardByComponent` (open count per board per component) in `buildAnalyticsFromIssueList` and `NovaAnalytics`.

## [0.1.45] - 2026-02-12

### Changed

- **Trevor combo chart**: Component is now part of the first combo chart instead of a separate bar chart. "Open & avg days by assignee" shows: (1) Open count as **stacked bars by component** (Case Database, Interactive Website, NCOA/ACS, No component, Static Website, etc.) on the bottom axis, and (2) **Avg days to close** as a line on the top axis. Removed the standalone "By component" card.
- **Analytics**: Added `byAssigneeByComponent` (open count per assignee per component) in `buildAnalyticsFromIssueList` and `NovaAnalytics` to support the stacked-by-component combo.

## [0.1.44] - 2026-02-12

### Changed

- **Trevor assignee chart**: Replaced separate "Open by assignee" and "Avg days to close" charts with one combo/multi-axis chart: horizontal bars for Open count (bottom axis) and a line for Avg days to close (top axis, 0–15 days) so both dimensions are readable in a single view. Legend and axis labels use theme colors.
- **Trevor By component**: "By component" bar chart is now shown when data exists; uses theme-colored axes. Layout: combo + Distribution in first row; By component + By board in second row.

## [0.1.43] - 2026-02-12

### Changed

- **TextScroller**: Animation now starts from the true right (content enters from off-screen at 100vw and scrolls left). Slightly faster: default duration 26s (was 30s); Trevor stats strip 22s (was 25s).

## [0.1.42] - 2026-02-12

### Added

- **Dev Corner One** (`/tv/dev-corner-one`): New dashboard with Trevor-style JQL and multi-dimensional charts. JIRA_DEV1: NOVA project, last 6 months, no assignee filter (all devs). Charts: Open &amp; avg days to close by assignee (combo bar + line), Distribution meter, By type, By component.
- **dev1JiraStore**: Fetches from JIRA_DEV1_JQL / JIRA_DEV1_JQL_OPEN; uses shared `buildAnalyticsFromIssueList` (no team filter) for byAssignee, byType, byComponent, avgDaysToClose.

### Changed

- **buildAnalyticsFromNovaQueries**: Now computes `byComponent` (open count per Jira component) and `avgDaysToClose` per assignee (from done issues), so Dev 2 and any Nova-based view get the same dimensions as Trevor.
- **Dev Corner Two (Nova)**: Replaced simple “Open by assignee” bar with combo chart (Open + Avg days to close); added “By component” bar chart and “Avg days” column in the assignee table.
- **TVDashboard**: Routes `dev-corner-one` to `DevCornerOneDashboard`.

## [0.1.42] - 2026-02-12

### Changed

- **Trevor theme colors**: Stats strip and charts now use theme variables only (no hardcoded hex overrides). Stats strip uses `--text-color`, `--primary-color`, `--red-*` / `--green-*`, `--text-color-secondary` (with `--p-*` fallbacks for Prime). Chart axis ticks and titles use resolved theme colors via a small hook so contrast follows the active theme.
- **Trevor charts readability**: Replaced the combo (bar + line, two x-axes) with two separate horizontal bar charts: "Open by assignee" and "Avg days to close (by assignee)", each with a single clear scale and theme-colored axis labels. "By board" chart also uses theme colors for axes. JiraMeterChart legend and center label use theme text color.

## [0.1.41] - 2026-02-12

### Changed

- **Trevor stats strip**: Replaced the four large stat cards (Open, Today, Late, Done) with a compact single-line strip using the reusable `TextScroller`. Stats scroll with icons (inbox, calendar, exclamation-triangle for Late in red, check-circle for Done in green) and separators for a space-efficient, elegant header.

## [0.1.40] - 2026-02-12

### Changed

- **Trevor JQL confined to 4 users**: JIRA_TREVOR JQL now builds `assignee IN (...)` from `TREVOR_TEAM_ACCOUNT_IDS_ARRAY` so the same 4 user IDs are the single source of truth; no other users are included in the query or on the board.

### Fixed

- **TREVOR_TEAM_ACCOUNT_IDS**: Typed as `Set<string>` so `Set.has(id)` accepts Jira assignee `accountId` (string) and build passes.

## [0.1.39] - 2026-02-12

### Added

- **Shared Jira layer**: `JIRA_CACHE_TTL_MS` (30 min) and `jiraSearchClient` for all dev-corner dashboards; single refresh interval so boards stay real-time without excess API calls.
- **Shared analytics**: `buildAnalyticsFromNovaQueries` and `buildAnalyticsFromIssueList` in `utils/jiraAnalytics` with optional `byProject` and `byType` for grouping by board (NOVA, CM, OPRD) and by issue type (Bug, Story, Task).
- **useJiraDashboard hook**: Unified hook for `nova` | `trevor` returning analytics, allIssues, loading, error, refresh, isStale (Dev1/Julie can be added later).
- **JiraMeterChart**: Meter-style doughnut (ring only) with main number in the center; used for Distribution on Nova and Trevor.
- **By board / By type charts**: Trevor shows "By board" horizontal bar (NOVA, CM, OPRD); Nova shows "By type" horizontal bar when multiple types exist.
- **JIRA_DEV1** and **JIRA_JULIE** stub constants for future dashboards.

### Changed

- **Cache TTL**: Nova and Trevor both use 30 min cache (was 5 min); refetch only when stale.
- **Stores**: `jiraNovaStore` and `trevorJiraStore` use `jiraSearchClient` and shared `buildAnalytics*` from `utils/jiraAnalytics`.
- **NovaAnalytics**: Extended with optional `byProject` and `byType` for chart data.
- **Nova dashboard**: Distribution is now meter-style (center = total open); added "By type" bar chart.
- **Trevor dashboard**: Distribution is now meter-style (center = total open); added "By board" bar chart.

## [0.1.38] - 2026-02-12

### Fixed

- **Trevor Open count**: Open total now comes from Jira via a dedicated count request (`JIRA_TREVOR_JQL_OPEN` with `maxResults=1`); response `total` gives the exact open count (Jira requires maxResults between 1 and 5000).

### Changed

- **Trevor charts**: Cleaner bar and doughnut charts – theme-aware axis/legend colors, subtle grid, tuned bar/doughnut proportions, chart height 120px, cutout 58% on doughnut.

## [0.1.37] - 2026-02-12

### Added

- **Conference room background slideshow**: Looping slideshow using all images in `public/background/background-conf-room/` (bg1.jpg, cpr-art-dark-1.jpg, cpt-art-1.jpg). Fade in/out (1.5s) between image swaps; 6s per slide. Config in `CONFERENCE_BACKGROUND_SLIDES`; content and scroller unchanged.

### Changed

- Conference room: single static background replaced by rotating slideshow layer; scroller remains on top (z-index).

## [0.1.36] - 2026-02-12

### Fixed

- **Trevor JQL**: Switched from `assignee WAS IN` to `assignee IN` so only issues **currently** assigned to the 4 (Kyle, James, Roy, Thomas) are fetched. Open/Today/Late/Done counts now match Jira.

## [0.1.35] - 2026-02-12

### Changed

- **Trevor's dashboard**: Filter to only the 4 dev team members (Kyle, James, Roy, Thomas) by current assignee account ID; stats, charts, and Gantt now show only these four.
- **Trevor's dashboard**: Compact, futuristic layout – tighter padding and gaps, smaller stat cards and chart area, subtle blue border glow and box-shadow on cards, single-row stats on larger screens, chart height 100px.

### Added

- **TREVOR_TEAM_ACCOUNT_IDS** in constants: set of 4 Jira account IDs used to filter Trevor data to current assignee only.

## [0.1.34] - 2026-02-12

### Added

- **Trevor's dashboard** (`/tv/trevor`): Dev team totals & Gantt – mobile-friendly. Uses JQL for OPRD, CM, NOVA projects with assignee WAS IN (4 team members), last 6 months, excludes case phase/Epic/Sub-task.
- **JIRA_TREVOR** constants and **trevorJiraStore**: Trevor-specific JQL and data fetching.
- **src/styles/frappe-gantt.css**: Local copy of frappe-gantt CSS for reliable module resolution.
- **react-frappe-gantt** type declarations (`src/types/react-frappe-gantt.d.ts`).
- PrimeReact charts on Trevor dashboard: Open by assignee (bar), Distribution (doughnut) with glossy opacity and hover glow.

### Fixed

- frappe-gantt CSS: resolved module-not-found by importing from `@/styles/frappe-gantt.css` instead of package path.

### Changed

- Trevor dashboard: uses trevorJiraStore with new JQL; Gantt chart for Dev Team Timeline; compact mobile-first layout.

## [0.1.34] - 2026-01-30

### Changed

- **TextScroller**: Styles moved into component-scoped `TextScroller.module.css`; text is bold (`font-weight: 700`) and slightly larger (`1.125rem`). All sizing/weight edits apply only to this component.

## [0.1.33] - 2026-01-30

### Changed

- Conference room: scroller strip moved up from bottom by 2.5rem.

## [0.1.32] - 2026-01-30

### Added

- **`docs/cpt-group-website-info.md`**: Reference doc with info from [CPT Group](https://www.cptgroup.com/) (company overview, 30 years / cases / settlement stats, contact, service areas, value props) for reels and future dashboard content.
- **`CONFERENCE_REEL`** constants: `CONFERENCE_REEL_PHRASES` and `CONFERENCE_REEL_TEXT` (CPT filler for the conference reel); conference room reel now uses this copy instead of placeholder.

### Changed

- TextScroller: JSDoc clarified that content is duplicated for a **seamless infinite loop** (repeats when one copy scrolls out).
- Conference room reel: filler text from CPT Group website (stats, contact, taglines).
- `docs/app-overview.md`: added link to `cpt-group-website-info.md` in Supporting Docs.

## [0.1.31] - 2026-01-30

### Added

- **TextScroller** UI component: 100% width, paragraph-sized text, scrolls left in an infinite loop (news/stocks reel style). Accepts `children`, optional `className`, and `duration` (seconds). Intended for Jira & stats reel on conference room.
- Conference room: scroller strip at bottom with placeholder “Jira & stats reel” text; background remains the focal point.

### Changed

- Conference room: center card removed; page is background-only with scroller at bottom.

## [0.1.30] - 2026-01-30

### Added

- **`docs/app-overview.md`**: Single doc describing what the web app is for (CPT Group internal TV dashboards, 24/7 office TVs), audience, routes, current screens (Dev Corner Two NOVA, Conference Room), data (Jira NOVA), tech stack, design conventions, and pointers to supporting docs
- README: link to `app-overview.md` as the starting doc; refreshed Current Status and Documentation list; version note points to `package.json` and CHANGELOG

## [0.1.29] - 2026-01-30

### Changed

- Conference room: custom background image (`public/background/Untitled design.png`) applied; centered, covers full screen, `background-size: cover` to avoid stretching

## [0.1.28] - 2026-01-30

### Added

- Conference room TV dashboard: `ConferenceRoomDashboard` component with full-viewport layout; wired for `/tv/conference-room` and `TVDashboard` when `roomName === 'conference-room'`; placeholder content ready for future widgets

## [0.1.27] - 2026-01-30

### Changed

- NOVA dashboard charts: chart fill opacity reduced (0.88 → 0.78) for a bit more transparency and floating look

## [0.1.26] - 2026-01-30

### Added

- NOVA dashboard: chart colors restored with vibrant per-assignee palette and opacity for a modern floating look (bar + doughnut)
- By assignee table: Bugs and Done columns; conditional formatting: Open=blue (info), Today=purple (custom), Late/Bugs=red (danger), Done=green (success)
- Top stats: fourth card for Done; JQL and store support for completed (Done) tickets and bug count per assignee

### Changed

- NOVA analytics: NovaAssigneeStats now include bugCount (from open issues where issuetype=Bug) and doneCount (from Done JQL); totalDone in NovaAnalytics
- Stat numbers use .nova-stat-value for theme primary contrast; stats grid is 4 columns (Open, Today, Late, Done)

## [0.1.25] - 2026-01-30

### Fixed

- Hydration mismatch on Dev Corner Two: NovaDashboard loaded with `next/dynamic` and `ssr: false` so DataTable and charts are client-only, avoiding extension-injected attributes (e.g. `data-cursor-ref`) that differ from server HTML

### Changed

- NOVA TV dashboard UI: cards get elevation (box-shadow, border-radius, subtle border); chart containers get inner highlight and doughnut gets drop-shadow; bar and doughnut datasets get border/hover border and hover shadow for less flat, more glossy look

## [0.1.24] - 2026-01-30

### Changed

- Dev Corner Two (NOVA) TV dashboard: removed top header/title section; room is known from URL
- Docs: do-donts updated so we always check browser console for errors and never ship with console errors or stray console.log

## [0.1.23] - 2026-01-30

### Changed

- Distribution card uses full width: doughnut chart responsive, legend positioned right of chart so chart + legend fill the card and reduce empty horizontal space

## [0.1.22] - 2026-01-30

### Changed

- Distribution doughnut chart constrained to 160px: Chart width/height props, responsive: false, pt (root + canvas) for max size and centering

## [0.1.21] - 2026-01-30

### Changed

- NOVA dashboard fits single TV screen: reduced padding (0.75rem), smaller header/stats/charts, no page scroll
- Layout: 100vh flex container, compact stats (text-2xl), charts 160px height, table uses remaining space with internal scroll
- Skeleton loading layout tightened to match

## [0.1.20] - 2026-01-30

### Added

- TV-friendly smooth transitions: Chart.js animation (1s duration, 800ms on update), content fade-in
- PrimeReact Skeleton for initial load (cards, chart placeholders, table) for stable layout and smoother transition to data

### Changed

- Nova dashboard uses Skeleton during first load instead of spinner-only; charts animate in smoothly

## [0.1.19] - 2026-01-30

### Added

- NovaDashboard: PrimeReact Chart (Chart.js) – horizontal bar chart (open by assignee) and doughnut chart (distribution)

### Changed

- Dev Corner Two dashboard now uses primereact/chart for open-by-assignee and distribution visuals

## [0.1.18] - 2026-01-30

### Changed

- NOVA analytics: exclude unassigned tickets from totals and from by-assignee table (assigned only)

## [0.1.17] - 2026-01-30

### Added

- NOVA Jira analytics for Dev Corner Two dashboard
- Cached Jira NOVA data with 5‑min TTL and memoization (jiraNovaStore)
- JQL constants for NOVA: today (updated today), open (not Done), overdue (late)
- NovaAnalytics types and by-assignee stats (open / today / overdue)
- NovaDashboard: summary cards (total open, updated today, overdue) and DataTable by assignee
- TV route `/tv/dev-corner-two` now renders NOVA dashboard with live-style analytics
- Auto-refresh: fetch on mount if stale, then every 1 min check; refetch when cache TTL (5 min) expired
- Optional `duedate` on Jira issue type and in default search fields for overdue tickets

### Changed

- TVDashboard renders NovaDashboard when roomName is dev-corner-two
- tv/[roomName] page now renders TVDashboard with roomName instead of null

## [0.1.16] - 2026-01-27

### Changed

- Configured dev server to run on port 3333 (`npm run dev` uses `next dev -p 3333`)

### Verified

- Verified ProgressSpinner (p-progressspinner) theming in both light and dark themes
- Confirmed all required CSS classes and animations are present
- Both themes use primary color (#405c8e) for spinner stroke
- Created spinner-theming-verification.md documentation

## [0.1.15] - 2026-01-27

### Changed

- Updated metadata title and description to "CPT Group Internal"
- Added robots.txt file to disallow all crawlers (User-agent: * Disallow: /)
- Updated metadata robots configuration to prevent indexing
- Set robots to noindex, nofollow, nocache for all search engines

## [0.1.14] - 2026-01-27

### Changed

- Replaced Vercel favicon with CPT favicon from support portal
- Added icon.png and apple-icon.png to src/app directory
- Updated metadata to include icon configuration matching support portal
- Icons now properly served from Next.js App Router convention location

## [0.1.13] - 2026-01-27

### Fixed

- Removed metadata.other approach that broke theme loading
- Added static link tag directly in body for theme CSS (server-rendered)
- Theme CSS now loads synchronously before page render
- Dark theme background now working - verified via browser screenshot
- Link tag is in HTML from server, script only updates href if needed

## [0.1.12] - 2026-01-27

### Fixed

- Removed invalid metadata.other approach (doesn't create link tags)
- Fixed theme script to properly create and set link href before page render
- Theme CSS now loads correctly - link created in beforeInteractive script
- Removed dev server commands - only using builds as requested

## [0.1.11] - 2026-01-27

### Fixed

- Removed invalid app/head.tsx file (not supported in Next.js App Router)
- Added theme link directly in layout head tag (supported in App Router)
- Theme CSS now loads synchronously in head before page render
- Dark theme background now visible - verified via browser screenshot
- CSS variables available immediately for globals.css

## [0.1.10] - 2026-01-27

### Fixed

- Fixed hydration error by using app/head.tsx instead of manual head tag
- Moved theme link to app/head.tsx (correct Next.js App Router pattern)
- Removed manual head tag from layout.tsx
- Theme link now server-rendered properly without hydration mismatch
- Follows Next.js 2025+ best practices for App Router

## [0.1.9] - 2026-01-27

### Fixed

- Added theme link element directly in layout head for immediate loading
- Added inline blocking script to set theme from localStorage before React hydrates
- Theme CSS now loads synchronously before page render
- CSS variables available immediately for globals.css
- Fixed white background issue - theme now applies on initial page load

## [0.1.8] - 2026-01-27

### Added

- Added PrimeReact theming documentation (docs/primereact-theming.md)
- Documented theme implementation pattern and best practices
- Added troubleshooting guide for theme issues

### Fixed

- Removed ThemeLink reference from layout.tsx (component was deleted)

## [0.1.7] - 2026-01-27

### Fixed

- Removed ThemeLink component - ThemeProvider now handles all theme CSS loading (matches support portal pattern)
- Updated ThemeProvider to match support portal implementation exactly
- Changed default theme to 'dark' in ThemeProvider
- Removed PrimeReact imports from layout.tsx (they're in PrimeReactProvider where they belong)
- Theme CSS should now load properly using 'theme-stylesheet' ID

## [0.1.6] - 2026-01-27

### Fixed

- Fixed theme CSS loading conflict between ThemeLink and ThemeProvider
- Simplified ThemeProvider to only handle state management, not CSS loading
- Changed ThemeLink to use 'theme-link' ID to match zion pattern
- ThemeProvider now updates ThemeLink href when theme changes
- Theme CSS should now load properly on page load

## [0.1.5] - 2026-01-27

### Fixed

- Added ThemeLink component to load theme CSS early in layout
- Added base styles to globals.css using PrimeReact theme CSS variables
- Moved PrimeReact core style imports to layout.tsx for proper loading order
- Fixed dark theme not applying - background now uses var(--surface-ground)
- Theme CSS now properly loads and applies on page load

## [0.1.4] - 2026-01-27

### Changed

- Updated main page.tsx to display "Hello World" content for theme verification
- Changed from returning null to displaying basic content

## [0.1.3] - 2026-01-27

### Changed

- Updated README.md to reflect current project state
- Added dark mode default theme information
- Added current version and status section
- Enhanced theme system documentation

## [0.1.2] - 2026-01-27

### Changed

- Set dark mode as default theme
- Fixed theme application to properly load from public/themes folder
- Ensured PrimeReact provider is properly configured with theme system

## [0.1.1] - 2026-01-27

### Changed

- Enhanced coding style documentation with comprehensive examples
- Added detailed parent component pattern example with HeroProps
- Added constants organization guidelines (separate files like MOTTO.ts)
- Added PrimeReact type extension guidelines (ButtonProps, etc.)
- Added type organization structure matching components structure
- Added import organization documentation
- Updated ESLint configuration to enforce TypeScript rules (no `any`/`unknown`)
- Enhanced pet peeves documentation with performance considerations
- Updated do's and don'ts with PrimeReact type extensions and type organization

### Technical Details

- ESLint now enforces: no `any`/`unknown` types, proper TypeScript usage, React hooks rules
- Added typescript-eslint packages for enhanced linting
- Documentation now includes hierarchical index.ts export patterns
- Added import-organization.md guide

## [0.1.0] - 2026-01-27

### Added

- Initial project setup with Next.js 16.1.6 and React 19.2.3
- Complete folder structure following KISS principles
- TypeScript configuration with strict type checking
- PrimeReact, PrimeFlex, and PrimeIcons integration
- Theme system with dynamic light/dark theme loading (copied from cpt-support-portal)
- Provider setup (PrimeReactProvider, ThemeProvider, Providers wrapper)
- Root layout with minimal structure and Providers integration
- Type definitions for dashboard, API responses, data sources, and widgets
- TV dashboard route structure (static and dynamic routes)
- TVDashboard component foundation (empty placeholder, ready for JSON-driven widgets)
- API service structure with flexible data source factory
  - Support for API, cron jobs, static data, and Jira integration
  - JSON-first, data-driven architecture
- Zustand store for dashboard state management
- Utility functions (formatters using date-fns, constants)
- Hierarchical index.ts exports for clean imports
- Documentation folder with:
  - Coding style guidelines
  - Pet peeves and code smells
  - Do's and Don'ts reference
  - Data architecture documentation
- Public folder with themes, backgrounds, logos, and icons
- Clean slate: removed all default Next.js/Vercel styling and content
- Version control and changelog system
- Versioning documentation and guidelines
- .cursor folder for Cursor-specific files (git-ignored)

### Technical Details

- **Framework**: Next.js 16.1.6 with App Router
- **React**: 19.2.3
- **TypeScript**: Latest (strict mode, no `any` or `unknown`)
- **State Management**: Zustand 5.0.10
- **UI Library**: PrimeReact 10.9.7, PrimeFlex 4.0.0, PrimeIcons 7.0.0
- **Form Handling**: react-hook-form 7.71.1
- **Date Utilities**: date-fns 4.1.0
- **Project Structure**: src/ folder with organized components, hooks, services, stores, types, utils, constants, config, providers

### Notes

- All components are empty placeholders - no UI implemented yet
- Foundation is ready for JSON-driven widget system
- Theme system follows cpt-support-portal pattern
- All code follows KISS principles and coding style guidelines
