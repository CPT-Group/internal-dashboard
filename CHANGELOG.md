# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with custom increment rules.

## Versioning Rules

- **Patch (0.0.1)**: Small changes, bug fixes, minor updates
- **Minor (0.1.0)**: Medium changes, new features, significant updates
- **Major (1.0.0)**: Major releases, production-ready milestones, breaking changes
- Version increments max at 9 (e.g., 0.9.9 → 1.0.0)

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
