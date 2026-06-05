# Internal Dashboard

Internal TV dashboard application for displaying company stats, heat maps, and other dashboard widgets on office TVs.

## Overview

This is a Next.js-based dashboard application designed to run on internal TVs throughout the office. Each TV is pointed at a route such as `/tv/dev-corner-one`, `/tv/dev-corner-two`, or `/tv/conference-room` (see **TV Routes** below).

## Agent Skills

Project skills live in `.cursor/skills/`. Use these slash-style prompts in chat when you want guided workflows:

- **`/website-health-check <site>`**
  - Runs case-level Website Health discrepancy analysis (`Submissions` vs `CleanClaims`) with source filters, missing-row review, and optional Teams-style update wording.
  - Input can be website DB, clean-claims DB, or case name.
  - Example: `/website-health-check ColumbiaUniversity_EEOC_C`

- **`/submission-health-check <site>`**
  - Runs one-site submission-volume report (`total`, `today`, `yesterday`) and supports controlled remediation steps when explicitly requested.
  - Default output is chat summary; can include Jira/Teams follow-up context if requested.
  - Example: `/submission-health-check CompassionHealthCare_Allin_C`

- **`/website-error-debug <site>`**
  - Builds a full one-site issue rundown (grouped error tables, pattern analysis, next-step recommendation) and defines safe fix protocol for confirmation sync / `IsSubmitted` corrections.
  - Default is chat-only; if a Jira ticket is included, also posts concise ticket updates.
  - Example: `/website-error-debug CompassionHealthCare_Allin_C NOVA-1282`

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **React**: 19
- **TypeScript**: Latest (strict mode)
- **UI Library**: PrimeReact 10.9.x, PrimeFlex 4, PrimeIcons 7
- **State Management**: Zustand 5
- **Form Handling**: react-hook-form 7
- **Date Utilities**: date-fns 4

## Project Structure

```text
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with Providers
│   ├── page.tsx            # Home page
│   ├── main.scss           # Global style entry (variables → base → utilities → themes)
│   └── tv/                 # TV dashboard routes
│       ├── page.tsx        # TV route index/landing
│       ├── [roomName]/     # Dynamic room routes
│       └── conference-room/ # Static route example
│
├── components/             # Shared/reusable components
│   ├── common/            # Generic components
│   ├── layout/            # Layout components
│   ├── ui/                # UI-specific components
│   └── pages/             # Page-level components
│       └── TVDashboard/   # TV dashboard component
│
├── hooks/                 # Custom hooks
├── services/              # Business logic & API
│   ├── api/              # API clients
│   └── data/             # Data services (API, cron, static)
├── stores/                # Zustand stores
├── types/                 # TypeScript definitions
├── utils/                 # Utility functions
├── constants/             # Application constants
├── config/                # Configuration
├── styles/                # Global SCSS (variables, base, utilities, themes)
└── providers/             # React context providers
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm, yarn, pnpm, or bun

### Installation

```bash
npm install
cp .env.example .env.local   # then fill in credentials (see AGENTS.md)
```

Copy **`.env.example`** to **`.env.local`** and add credentials. Jira TV dashboards need `KYLE_EMAIL` and `KYLE_JIRA_TOKEN`; SQL-backed features need `DB_*` / `PROD_DB_*`. The UI starts without secrets, but live data routes will be empty or error until env is set.

### Development

```bash
npm run dev
```

Open [http://localhost:3333](http://localhost:3333) with your browser.

Do **not** run `next dev` directly — use `npm run dev` so slide-list generation and cursor-analytics summary scripts run first (see `AGENTS.md`).

### Build

```bash
npm run build
```

### Start Production Server

Requires a successful `npm run build` first (`next start` needs a `.next` BUILD_ID).

```bash
npm start
```

Production serves on [http://localhost:3000](http://localhost:3000) by default (Next.js default port).

## Features

### Data-Driven Architecture

The application uses a **JSON-first, data-driven architecture** that supports multiple data sources:

- **API**: Real-time data from REST endpoints
- **Cron Jobs**: Data pulled periodically (Jira, external APIs)
- **Static**: Configuration and rarely-changing data

All data sources return consistent JSON structures, making components source-agnostic.

### Theme System

SCSS-based theme system (aligned with cpt-internal-tools):

- **Default theme**: **dark-synth** (synthwave purple/cyan). Also available: dark, light, ms-access-2010.
- Theme is applied via `data-theme` on `<html>`; one CSS bundle (no dynamic theme link).
- Theme preference stored in `localStorage` under `cpt-theme`. Invalid or missing value falls back to dark-synth.
- **Theme switcher**: Home page only (sticky button at top cycles themes). Other routes have no switcher.
- **Full details**: See **`docs/theme-system.md`** for usage, file structure, and how to add or update themes.

### TV Routes

Active TV slugs (see `src/constants/routes.ts`):

| Route | Dashboard |
|-------|-----------|
| `/tv/dev-corner-one` | Dev Corner One — developer KPIs, work hours, impediments, team activity |
| `/tv/dev-corner-two` | Dev Corner Two — company-facing carousel (in progress, completed, GitHub deploy) |
| `/tv/trevor` | Trevor's Screen — NOVA team load and tickets |
| `/tv/conference-room` | Conference Room — background slideshow |
| `/tv/jackie` | Jackie's Office — background slideshow |
| `/tv/julie` | Julie's Office — background slideshow |
| `/tv/github-activity` | GitHub webhook activity feed |

Dynamic route: `/tv/[roomName]` resolves through `TVDashboard` by room name.

## Development Guidelines

### Coding Style

See `docs/coding-style.md` for comprehensive coding guidelines. Key principles:

- **KISS**: Keep It Stupid Simple
- **Small Components**: Maximum 300 lines per file
- **Type Safety**: Full TypeScript, no `any` or `unknown`
- **Performance**: Proper memoization, caching, avoid unnecessary re-renders
- **Separation of Concerns**: Components, hooks, services, types all separated

### Code Smells

See `docs/pet-peeves.md` for common code smells to avoid:

- Files > 300 lines
- Excessive HTML without components
- Repeated code not modularized
- API calls on every render without caching
- Hard to pinpoint root causes

### Best Practices

See `docs/do-donts.md` for do's and don'ts reference.

### Reusable Copy-To-Clipboard UI

Use `CopyToClipboardButton` from `@/components/ui` whenever a view needs to copy IDs, URLs, DB names, or similar values.

- **Component path**: `src/components/ui/CopyToClipboardButton/CopyToClipboardButton.tsx`
- **Export**: `import { CopyToClipboardButton } from '@/components/ui';`
- **Behavior**: standard clipboard write logic + consistent success/error toast messages
- **Current usage reference**: `src/components/pages/WebsiteHealthDashboard/WebsiteHealthDashboard.tsx`

Example:

```tsx
<CopyToClipboardButton
  value={ticketUrl}
  valueLabel="Jira ticket URL"
  onToast={showToast}
  className={styles.copyValueButton}
  tooltipPosition="left"
/>
```

### Website Health Jira Ticket Defaults

Website Health creates Jira tickets through `POST /api/jira/website-health-ticket`.

- Default project: `NOVA` (`WEBSITE_HEALTH_JIRA_PROJECT_KEY` to override)
- Default issue type: `Task` (`WEBSITE_HEALTH_JIRA_ISSUE_TYPE` to override)
- Note: NOVA `Bug` may require extra custom fields (Actual Results, Expected Results, Frequency, Stage Found, User Impact, etc.). If you set issue type to `Bug`, make sure your automation also supplies all required fields for your Jira screen/workflow.

### Website Health Submission Report

Website Health can also send an active-site submission summary to the same Teams webhook via `POST /api/website-health/submission-report`.

- Uses active-site mappings from OCPAutomation (same source as Website Health scan)
- Applies Website Health source filters (`DateReceived IS NOT NULL`, test-ID exclusion, `@cptgroup.com` exclusion, and same-day cutoff at 5:15 AM)
- Teams table columns: site, status, total submitted, submitted today, submitted yesterday
- Dashboard button: `Submission Report` on `/website-health`

### Data Architecture

See `docs/data-architecture.md` for details on the JSON-driven data approach.

## Versioning

This project follows semantic versioning with custom increment rules:

- **Patch (0.0.1)**: Small changes, bug fixes
- **Minor (0.1.0)**: Medium changes, new features
- **Major (1.0.0)**: Major releases, production-ready

See `package.json` for the current version and `CHANGELOG.md` for version history.

## Documentation

- **`AGENTS.md`** (repo root) – **Start here for AI agents and deep Jira/dashboard context.** Setup, validation, env vars, TV layout rules.
- **`docs/app-overview.md`** – Human-oriented overview: routes, data sources, ports, current dashboards.
- `docs/dashboard-planning.md` - Route structure, home design, dev dashboard layout
- `docs/coding-style.md` - Comprehensive coding style guidelines with examples
- `docs/pet-peeves.md` - Code smells and anti-patterns
- `docs/do-donts.md` - Best practices reference
- `docs/data-architecture.md` - Data-driven JSON approach
- `docs/jira-ticket-schema.md` - Jira issue shape for NOVA
- `docs/versioning.md` - Version control and changelog guidelines
- `docs/import-organization.md` - Import order and hierarchical exports
- `docs/style-guide-summary.md` - Quick reference summary
- **`docs/theme-system.md`** – **Theme reference.** How the theme system works, how to use it, and how to add/update themes (for developers and agents).
- `docs/primereact-theming.md` - PrimeReact theming (legacy; see theme-system.md for current behavior)
- `CHANGELOG.md` - Version history and changes

## Current Status

- **Version**: See `package.json` (e.g. 0.1.x)
- **Theme**: dark-synth (default), dark, light, ms-access-2010; switch on home page only. See `docs/theme-system.md`.
- **Home**: Card-based TV dashboard selector; links to `/tv/{roomName}`
- **TV dashboards**: Dev Corner One (developer operational analytics); Dev Corner Two (company-facing carousel + GitHub deploy); Trevor's Screen (NOVA load); Conference Room, Jackie, Julie (slideshow backgrounds); `/tv/github-activity` (webhook feed)
- **Data**: Operational Jira (CM + OPRD + NOVA) via `operationalJiraStore`; cache TTL 20 min business hours / 60 min off-hours Pacific

## License

Private - Internal use only
